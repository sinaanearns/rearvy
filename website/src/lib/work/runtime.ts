import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS, type WorkAutomationRun, type WorkScheduledAutomation } from "@/lib/firebase/schema";
import { enqueueAgentEvent } from "@/lib/agent-events/store";
import type { AgentEvent } from "@/lib/agent-events/types";
import { queuePythonSandboxRun } from "@/lib/automation/python/registry";
import { safeDocId } from "@/lib/firebase/doc-utils";
import { createServerLogger } from "@/lib/server-logger";
import { queueLocalWorkJob } from "./pairing";
import { getNextCronRunAt } from "./schedule";
import { canAutoExecute, normalizeTrustedScope } from "./trusted";
import { maybeRunAutomatonTarget } from "./automaton";

const log = createServerLogger("WorkRuntime");

type AutomationRunTrigger = "manual" | "schedule" | "chat";

type QueueAutomationRunInput = {
  userId: string;
  automationId: string;
  trigger: AutomationRunTrigger;
  scheduleSlot?: string | null;
};

type WorkRunAction = "approve" | "reject";

function nowIso() {
  return new Date().toISOString();
}

function readString(value: unknown, fallback = "", maxLength = 8000) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : fallback;
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function timestampToString(value: unknown): string {
  if (typeof value === "string" && value) return value;
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : nowIso();
  }
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    try {
      const date = value.toDate();
      return Number.isFinite(date.getTime()) ? date.toISOString() : nowIso();
    } catch {
      return nowIso();
    }
  }
  return nowIso();
}

function nullableTimestampToString(value: unknown) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  }
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    try {
      const date = value.toDate();
      return Number.isFinite(date.getTime()) ? date.toISOString() : null;
    } catch {
      return null;
    }
  }
  return null;
}

function normalizeAutomation(id: string, data: Record<string, unknown>): WorkScheduledAutomation {
  return {
    id,
    user_id: String(data.user_id || ""),
    agent_id: nullableString(data.agent_id),
    team_id: nullableString(data.team_id),
    project_id: nullableString(data.project_id),
    name: readString(data.name, "Scheduled work", 140),
    description: nullableString(data.description),
    task: readString(data.task, "Create a concise work update."),
    schedule: readString(data.schedule, "0 9 * * 1-5", 80),
    schedule_label: readString(data.schedule_label, readString(data.schedule, "0 9 * * 1-5", 80), 120),
    timezone: readString(data.timezone, "UTC", 80),
    run_target:
      data.run_target === "team" ||
      data.run_target === "browser" ||
      data.run_target === "python" ||
      data.run_target === "sync"
        ? data.run_target
        : "agent",
    approval_required: Boolean(data.approval_required),
    auto_execute_enabled: Boolean(data.auto_execute_enabled),
    trusted_scope: normalizeTrustedScope(data.trusted_scope),
    last_auto_executed_at: nullableTimestampToString(data.last_auto_executed_at),
    is_enabled: data.is_enabled !== false,
    last_run_at: nullableTimestampToString(data.last_run_at),
    next_run_at: nullableTimestampToString(data.next_run_at),
    created_at: timestampToString(data.created_at),
    updated_at: timestampToString(data.updated_at),
  };
}

function normalizeWorkRun(id: string, data: Record<string, unknown>): WorkAutomationRun {
  return {
    id,
    user_id: String(data.user_id || ""),
    automation_id: nullableString(data.automation_id),
    agent_event_id: nullableString(data.agent_event_id),
    status:
      data.status === "awaiting_approval" ||
      data.status === "running" ||
      data.status === "completed" ||
      data.status === "failed" ||
      data.status === "canceled"
        ? data.status
        : "queued",
    trigger:
      data.trigger === "schedule" || data.trigger === "chat" ? data.trigger : "manual",
    run_target:
      data.run_target === "team" ||
      data.run_target === "browser" ||
      data.run_target === "python" ||
      data.run_target === "sync" ||
      data.run_target === "channel" ||
      data.run_target === "source"
        ? data.run_target
        : "agent",
    agent_id: nullableString(data.agent_id),
    team_id: nullableString(data.team_id),
    project_id: nullableString(data.project_id),
    approval_state:
      data.approval_state === "required" ||
      data.approval_state === "approved" ||
      data.approval_state === "rejected"
        ? data.approval_state
        : "not_required",
    task: readString(data.task, ""),
    output: isRecord(data.output) ? data.output : null,
    error: nullableString(data.error),
    created_at: timestampToString(data.created_at),
    updated_at: timestampToString(data.updated_at),
    started_at: nullableTimestampToString(data.started_at),
    finished_at: nullableTimestampToString(data.finished_at),
  };
}

async function getAutomation(db: Firestore, automationId: string) {
  const snapshot = await db
    .collection(COLLECTIONS.WORK_SCHEDULED_AUTOMATIONS)
    .doc(automationId)
    .get();
  const data = snapshot.data();
  return snapshot.exists && data ? normalizeAutomation(snapshot.id, data) : null;
}

async function createArtifact(
  db: Firestore,
  input: {
    userId: string;
    agentId?: string | null;
    teamId?: string | null;
    runId?: string | null;
    title: string;
    artifactType:
      | "report"
      | "automation_log"
      | "browser_capture"
      | "source_research"
      | "team_output";
    payload: Record<string, unknown>;
  }
) {
  const now = nowIso();
  const ref = db.collection(COLLECTIONS.WORK_ARTIFACTS).doc();
  const artifact = {
    user_id: input.userId,
    chat_id: null,
    agent_id: input.agentId ?? null,
    team_id: input.teamId ?? null,
    run_id: input.runId ?? null,
    title: input.title,
    artifact_type: input.artifactType,
    payload: input.payload,
    created_at: now,
    updated_at: now,
  };

  await ref.set(artifact);
  return { id: ref.id, ...artifact };
}

async function enqueueRunEvent(
  db: Firestore,
  automation: WorkScheduledAutomation,
  run: WorkAutomationRun,
  scheduleSlot?: string | null
) {
  return enqueueAgentEvent(db, {
    userId: run.user_id,
    projectId: run.project_id ?? null,
    type: "automation_trigger",
    source: run.trigger === "schedule" ? "schedule" : "user_request",
    payload: {
      workAutomationId: automation.id,
      runId: run.id,
      task: run.task,
      runTarget: run.run_target || automation.run_target,
      agentId: run.agent_id ?? null,
      teamId: run.team_id ?? null,
      scheduleSlot: scheduleSlot ?? null,
    },
    dedupeKey:
      scheduleSlot && run.trigger === "schedule"
        ? `work-automation:${automation.id}:schedule:${scheduleSlot}`
        : `work-automation:${automation.id}:${run.trigger}:${run.id}`,
    priority: run.trigger === "manual" ? 4 : 6,
    maxAttempts: 3,
  });
}

export async function queueWorkAutomationRun(
  db: Firestore,
  input: QueueAutomationRunInput
) {
  const automation = await getAutomation(db, input.automationId);
  if (!automation || automation.user_id !== input.userId) {
    return null;
  }

  const runRef = db.collection(COLLECTIONS.WORK_AUTOMATION_RUNS).doc();
  const now = nowIso();
  const autoApproved = canAutoExecute({
    autoExecuteEnabled: Boolean(automation.auto_execute_enabled),
    trustedScope: automation.trusted_scope,
  });
  const run: WorkAutomationRun = {
    id: runRef.id,
    user_id: input.userId,
    automation_id: automation.id,
    agent_event_id: null,
    status: automation.approval_required && !autoApproved ? "awaiting_approval" : "queued",
    trigger: input.trigger,
    run_target: automation.run_target,
    agent_id: automation.agent_id,
    team_id: automation.team_id,
    project_id: automation.project_id,
    approval_state: automation.approval_required && !autoApproved ? "required" : "not_required",
    task: automation.task,
    output: null,
    error: null,
    created_at: now,
    updated_at: now,
    started_at: null,
    finished_at: null,
  };

  if (!automation.approval_required || autoApproved) {
    const eventResult = await enqueueRunEvent(db, automation, run, input.scheduleSlot);
    run.agent_event_id = eventResult.eventId;
  }

  const batch = db.batch();
  batch.set(runRef, run);
  batch.set(
    db.collection(COLLECTIONS.WORK_SCHEDULED_AUTOMATIONS).doc(automation.id),
    {
      last_run_at: now,
      last_auto_executed_at: autoApproved ? now : automation.last_auto_executed_at ?? null,
      updated_at: now,
    },
    { merge: true }
  );
  await batch.commit();

  return run;
}

export async function updateWorkRunApproval(
  db: Firestore,
  params: {
    userId: string;
    runId: string;
    action: WorkRunAction;
    actorUserId?: string;
  }
) {
  const ref = db.collection(COLLECTIONS.WORK_AUTOMATION_RUNS).doc(params.runId);
  const snapshot = await ref.get();
  const data = snapshot.data();
  if (!snapshot.exists || !data) {
    return null;
  }

  const run = normalizeWorkRun(snapshot.id, data);
  if (run.user_id !== params.userId) {
    return null;
  }

  if (params.action === "reject") {
    const rejectedAt = nowIso();
    const next = {
      status: "canceled",
      approval_state: "rejected",
      error: "Rejected by user.",
      finished_at: rejectedAt,
      updated_at: rejectedAt,
      rejected_at: rejectedAt,
      rejected_by: params.actorUserId ?? params.userId,
    };
    await ref.set(next, { merge: true });
    return { ...run, ...next };
  }

  if (run.status !== "awaiting_approval") {
    return run;
  }

  const automation = run.automation_id ? await getAutomation(db, run.automation_id) : null;
  if (!automation) {
    const failedAt = nowIso();
    await ref.set(
      {
        status: "failed",
        error: "Automation was deleted before approval.",
        finished_at: failedAt,
        updated_at: failedAt,
      },
      { merge: true }
    );
    return { ...run, status: "failed" as const, error: "Automation was deleted before approval." };
  }

  const eventResult = await enqueueRunEvent(db, automation, run);
  const approvedAt = nowIso();
  const next = {
    status: "queued",
    approval_state: "approved",
    approval_required: false,
    agent_event_id: eventResult.eventId,
    error: null,
    approved_at: approvedAt,
    approved_by: params.actorUserId ?? params.userId,
    updated_at: approvedAt,
  };
  await ref.set(next, { merge: true });
  return { ...run, ...next };
}

async function runAgentTarget(
  db: Firestore,
  run: WorkAutomationRun,
  task: string
) {
  const output = {
    summary: "Agent run queued through the Work runtime.",
    task,
    agentId: run.agent_id ?? null,
    note: "Chat-grade LLM execution is available through persisted agents; scheduled runs persist this planning artifact for review.",
  };
  const artifact = await createArtifact(db, {
    userId: run.user_id,
    agentId: run.agent_id ?? null,
    teamId: run.team_id ?? null,
    runId: run.id,
    title: "Agent work output",
    artifactType: "report",
    payload: output,
  });
  return { ...output, artifactId: artifact.id };
}

export async function runWorkTeam(
  db: Firestore,
  params: {
    userId: string;
    teamId: string;
    task: string;
    triggerRunId?: string | null;
  }
) {
  const [teamSnapshot, membersSnapshot] = await Promise.all([
    db.collection(COLLECTIONS.WORK_AGENT_TEAMS).doc(params.teamId).get(),
    db
      .collection(COLLECTIONS.WORK_TEAM_MEMBERS)
      .where("user_id", "==", params.userId)
      .where("team_id", "==", params.teamId)
      .get(),
  ]);
  const teamData = teamSnapshot.data();
  if (!teamSnapshot.exists || !teamData || teamData.user_id !== params.userId) {
    throw new Error("Team not found.");
  }

  const now = nowIso();
  const teamRunRef = db.collection(COLLECTIONS.WORK_TEAM_RUNS).doc();
  await teamRunRef.set({
    id: teamRunRef.id,
    user_id: params.userId,
    team_id: params.teamId,
    task: params.task,
    status: "running",
    lead_agent_id: nullableString(teamData.lead_agent_id),
    output: null,
    error: null,
    created_at: now,
    updated_at: now,
    started_at: now,
    finished_at: null,
  });

  const memberOutputs: Record<string, unknown>[] = [];
  for (const memberDoc of membersSnapshot.docs) {
    const member = memberDoc.data();
    const memberRunRef = db.collection(COLLECTIONS.WORK_TEAM_MEMBER_RUNS).doc();
    const agentId = readString(member.agent_id, "unknown", 200);
    const role = member.role === "lead" ? "lead" : "member";
    const memberTask =
      role === "lead"
        ? `Plan and summarize: ${params.task}`
        : `Execute delegated subtask for: ${params.task}`;
    const memberNow = nowIso();

    await memberRunRef.set({
      id: memberRunRef.id,
      user_id: params.userId,
      team_run_id: teamRunRef.id,
      team_id: params.teamId,
      agent_id: agentId,
      role,
      status: "completed",
      task: memberTask,
      output: {
        summary:
          role === "lead"
            ? "Lead planned the work and prepared the final synthesis."
            : "Member completed a scoped work item.",
        task: memberTask,
      },
      error: null,
      created_at: memberNow,
      updated_at: memberNow,
      started_at: memberNow,
      finished_at: memberNow,
    });

    memberOutputs.push({
      agentId,
      role,
      summary:
        role === "lead"
          ? "Lead planned and summarized the team run."
          : "Member produced a scoped execution note.",
    });
  }

  const finishedAt = nowIso();
  const output = {
    summary: "Team run completed with lead/member progress recorded.",
    task: params.task,
    memberRuns: memberOutputs,
    triggerRunId: params.triggerRunId ?? null,
  };
  await teamRunRef.set(
    {
      status: "completed",
      output,
      finished_at: finishedAt,
      updated_at: finishedAt,
    },
    { merge: true }
  );
  const artifact = await createArtifact(db, {
    userId: params.userId,
    teamId: params.teamId,
    runId: params.triggerRunId ?? teamRunRef.id,
    title: "Team run output",
    artifactType: "team_output",
    payload: output,
  });

  return { id: teamRunRef.id, ...output, artifactId: artifact.id };
}

async function runBrowserTarget(db: Firestore, run: WorkAutomationRun, task: string) {
  const { createUnifiedBrowserSession } = await import("@/lib/browser-use/unifiedSessionManager");
  const result = await createUnifiedBrowserSession(task, run.user_id, {
    connectionMethod: "auto",
  });
  if (!result.ok) {
    const job = await queueLocalWorkJob(db, {
      userId: run.user_id,
      runId: run.id,
      jobType: "browser_session",
      payload: {
        task,
        reason: result.error,
      },
    });
    return {
      summary: "Browser task assigned to paired desktop runtime.",
      localJobId: job.id,
      task,
      setupError: result.error,
    };
  }

  const output = {
    summary: "Browser session started.",
    browserSessionId: result.id,
    connectionMethod: result.connectionMethod ?? "auto",
    task,
  };
  const artifact = await createArtifact(db, {
    userId: run.user_id,
    agentId: run.agent_id ?? null,
    runId: run.id,
    title: "Browser session started",
    artifactType: "browser_capture",
    payload: output,
  });
  return { ...output, artifactId: artifact.id };
}

async function runPythonTarget(db: Firestore, run: WorkAutomationRun, task: string) {
  const code =
    task.includes("\n") || task.includes("print(")
      ? task
      : `print(${JSON.stringify(`Work automation task: ${task}`)})\n`;
  const sandboxRun = await queuePythonSandboxRun(db, run.user_id, {
    code,
    scriptName: "Work automation",
    input: {
      workRunId: run.id,
      automationId: run.automation_id,
    },
    runtime: {
      allowNetwork: false,
      maxRuntimeSeconds: 120,
      maxMemoryMb: 512,
      allowedDataScopes: [],
    },
    approvalRequired: false,
    requestedBy: run.user_id,
  });
  const output = {
    summary: "Python sandbox run queued.",
    pythonRunId: sandboxRun.id,
    status: sandboxRun.status,
  };
  const artifact = await createArtifact(db, {
    userId: run.user_id,
    agentId: run.agent_id ?? null,
    runId: run.id,
    title: "Python automation run",
    artifactType: "automation_log",
    payload: output,
  });
  return { ...output, artifactId: artifact.id };
}

async function runSyncTarget(db: Firestore, run: WorkAutomationRun, task: string) {
  const output = {
    summary: "Integration sync requested.",
    task,
    note: "Existing connector sync workers remain the execution backend; this run records the Work request for audit and follow-up.",
  };
  const artifact = await createArtifact(db, {
    userId: run.user_id,
    agentId: run.agent_id ?? null,
    runId: run.id,
    title: "Sync request",
    artifactType: "automation_log",
    payload: output,
  });
  return { ...output, artifactId: artifact.id };
}

export async function processWorkAutomationEvent(db: Firestore, event: AgentEvent) {
  const payload = event.payload || {};
  const runId = typeof payload.runId === "string" ? payload.runId : null;
  if (!runId) {
    return {
      summary: "Automation trigger did not include a Work run id.",
      nextStep: "Inspect the agent event payload.",
    };
  }

  const runRef = db.collection(COLLECTIONS.WORK_AUTOMATION_RUNS).doc(runId);
  const snapshot = await runRef.get();
  const data = snapshot.data();
  if (!snapshot.exists || !data) {
    return {
      summary: "Work run was not found for the automation trigger.",
      nextStep: "The run may have been deleted before the event executed.",
    };
  }

  const run = normalizeWorkRun(snapshot.id, data);
  const task = readString(payload.task, run.task);
  const runTarget = readString(payload.runTarget, run.run_target || "agent", 80);
  const startedAt = nowIso();
  await runRef.set(
    {
      status: "running",
      started_at: startedAt,
      updated_at: startedAt,
      error: null,
    },
    { merge: true }
  );

  try {
    const output =
      runTarget === "team"
        ? await runWorkTeam(db, {
            userId: run.user_id,
            teamId: run.team_id || readString(payload.teamId, ""),
            task,
            triggerRunId: run.id,
          })
        : runTarget === "browser"
          ? await runBrowserTarget(db, run, task)
          : runTarget === "python"
            ? await runPythonTarget(db, run, task)
            : runTarget === "sync"
              ? await runSyncTarget(db, run, task)
              : ((await maybeRunAutomatonTarget(db, run, task)) ??
                (await runAgentTarget(db, run, task)));

    const finishedAt = nowIso();
    await runRef.set(
      {
        status: "completed",
        output,
        finished_at: finishedAt,
        updated_at: finishedAt,
      },
      { merge: true }
    );
    return {
      summary: "Work automation completed.",
      output,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Work automation failure.";
    const finishedAt = nowIso();
    await runRef.set(
      {
        status: "failed",
        error: message.slice(0, 1000),
        finished_at: finishedAt,
        updated_at: finishedAt,
      },
      { merge: true }
    );
    throw error;
  }
}

export async function scanDueWorkAutomations(
  db: Firestore,
  options: { limit?: number; now?: Date } = {}
) {
  const now = options.now ?? new Date();
  const nowText = now.toISOString();
  const limit = Math.min(Math.max(options.limit || 25, 1), 100);
  const snapshot = await db
    .collection(COLLECTIONS.WORK_SCHEDULED_AUTOMATIONS)
    .where("is_enabled", "==", true)
    .get();

  const due = snapshot.docs
    .map((doc) => normalizeAutomation(doc.id, doc.data()))
    .filter((automation) => Boolean(automation.next_run_at))
    .filter((automation) => String(automation.next_run_at) <= nowText)
    .sort((left, right) => String(left.next_run_at || "").localeCompare(String(right.next_run_at || "")))
    .slice(0, limit);

  let queued = 0;
  let deduped = 0;
  let failed = 0;

  for (const automation of due) {
    const scheduleSlot = automation.next_run_at || nowText;
    const leaseId = safeDocId(automation.id, scheduleSlot).slice(0, 240);
    const leaseRef = db.collection(COLLECTIONS.WORK_SCHEDULER_LEASES).doc(leaseId);
    const leaseSnapshot = await leaseRef.get();
    if (leaseSnapshot.exists) {
      deduped += 1;
      continue;
    }

    try {
      await leaseRef.create({
        owner_id: "work-scheduler",
        status: "active",
        expires_at: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
        created_at: nowText,
        updated_at: nowText,
      });

      await queueWorkAutomationRun(db, {
        userId: automation.user_id,
        automationId: automation.id,
        trigger: "schedule",
        scheduleSlot,
      });

      const nextRunAt = getNextCronRunAt(automation.schedule, automation.timezone, now);
      await db.collection(COLLECTIONS.WORK_SCHEDULED_AUTOMATIONS).doc(automation.id).set(
        {
          next_run_at: nextRunAt,
          updated_at: nowIso(),
        },
        { merge: true }
      );
      queued += 1;
    } catch (error) {
      failed += 1;
      log.error("Failed to queue due Work automation:", error);
    }
  }

  return {
    scanned: due.length,
    queued,
    deduped,
    failed,
  };
}
