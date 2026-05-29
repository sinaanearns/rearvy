import type { Firestore } from "firebase-admin/firestore";
import {
  COLLECTIONS,
  type WorkAgent,
  type WorkAutomationRun,
} from "@/lib/firebase/schema";
import { createAssistantAlertRecord } from "@/lib/assistant-alerts-store";
import { saveMemoryRecord } from "@/lib/memory-store";
import { createSourceTask } from "./sources";
import { createWorkTask } from "./tasks";
import { AUTOMATON_AGENT_KEY } from "./platform";
import {
  scoreWorkAgents,
  type AgentActivity,
  type AutomatonAgentScore,
} from "./automaton-quality";

export type AutomatonAction = {
  type: "task" | "source_research" | "agent_archive" | "memory" | "alert";
  label: string;
  status: "queued" | "prepared" | "completed" | "skipped";
  targetId?: string | null;
};

export type AutomatonBlocker = {
  reason: string;
  detail: string;
  severity: "info" | "warning" | "error";
  needsUser: boolean;
};

export type AutomatonOperatingOutput = {
  summary: string;
  actionsQueued: AutomatonAction[];
  blockers: AutomatonBlocker[];
  needsAssistance: boolean;
  agentScores: AutomatonAgentScore[];
  nextWatchItems: string[];
  state: Record<string, unknown>;
  artifactId?: string;
};

function nowIso() {
  return new Date().toISOString();
}

function readString(value: unknown, fallback = "", maxLength = 1000) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : fallback;
}

function timestampToMillis(value: unknown) {
  if (!value) return 0;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object") {
    const maybe = value as { toDate?: () => Date; toMillis?: () => number };
    if (typeof maybe.toMillis === "function") {
      const millis = maybe.toMillis();
      return Number.isFinite(millis) ? millis : 0;
    }
    if (typeof maybe.toDate === "function") {
      const millis = maybe.toDate().getTime();
      return Number.isFinite(millis) ? millis : 0;
    }
  }
  return 0;
}

function isAutomatonAgentRecord(agent: Pick<WorkAgent, "built_in_key" | "name" | "source"> | null) {
  return Boolean(
    agent &&
      agent.source === "built_in" &&
      (agent.built_in_key === AUTOMATON_AGENT_KEY || agent.name === "Automaton")
  );
}

function isClientAcquisitionTask(task: string) {
  return /\b(get|find|acquire|prospect|lead|clients?|customers?)\b/i.test(task);
}

async function loadUserDocs(db: Firestore, collection: string, userId: string) {
  const snapshot = await db.collection(collection).where("user_id", "==", userId).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Record<string, unknown>);
}

function latestDocs(docs: Record<string, unknown>[], limit: number) {
  return [...docs]
    .sort((left, right) =>
      String(right.updated_at || right.created_at || "").localeCompare(
        String(left.updated_at || left.created_at || "")
      )
    )
    .slice(0, limit);
}

function buildActivityMap(params: {
  agents: Record<string, unknown>[];
  automations: Record<string, unknown>[];
  automationRuns: Record<string, unknown>[];
  teams: Record<string, unknown>[];
  teamMembers: Record<string, unknown>[];
}) {
  const activityByAgentId = new Map<string, AgentActivity>();
  const activeTeamIds = new Set(
    params.teams
      .filter((team) => team.is_active !== false)
      .map((team) => readString(team.id, ""))
      .filter(Boolean)
  );

  const ensureActivity = (agentId: string) => {
    const current = activityByAgentId.get(agentId) ?? {
      successfulRunsLast14: 0,
      failedRunsLast14: 0,
      activeAutomationRefs: 0,
      activeTeamRefs: 0,
    };
    activityByAgentId.set(agentId, current);
    return current;
  };

  for (const agent of params.agents) {
    const id = readString(agent.id, "");
    if (id) ensureActivity(id);
  }

  for (const automation of params.automations) {
    const agentId = readString(automation.agent_id, "");
    if (agentId && automation.is_enabled !== false) {
      ensureActivity(agentId).activeAutomationRefs += 1;
    }
  }

  for (const team of params.teams) {
    const leadAgentId = readString(team.lead_agent_id, "");
    if (leadAgentId && team.is_active !== false) {
      ensureActivity(leadAgentId).activeTeamRefs += 1;
    }
  }

  for (const member of params.teamMembers) {
    const teamId = readString(member.team_id, "");
    const agentId = readString(member.agent_id, "");
    if (agentId && activeTeamIds.has(teamId)) {
      ensureActivity(agentId).activeTeamRefs += 1;
    }
  }

  const cutoff = Date.now() - 14 * 86_400_000;
  for (const run of params.automationRuns) {
    const agentId = readString(run.agent_id, "");
    if (!agentId) continue;
    const createdAt = timestampToMillis(run.created_at);
    if (createdAt < cutoff) continue;
    const activity = ensureActivity(agentId);
    if (run.status === "completed") {
      activity.successfulRunsLast14 += 1;
    } else if (run.status === "failed") {
      activity.failedRunsLast14 += 1;
    }
  }

  return activityByAgentId;
}

async function persistAgentScores(
  db: Firestore,
  scores: AutomatonAgentScore[],
  actionsQueued: AutomatonAction[]
) {
  if (scores.length === 0) {
    return;
  }

  const batch = db.batch();
  const evaluatedAt = nowIso();

  for (const score of scores) {
    const patch: Record<string, unknown> = {
      performance_score: score.score,
      quality_status: score.qualityStatus,
      last_evaluated_at: evaluatedAt,
      low_score_streak: score.lowScoreStreak,
      archive_reason: score.archived ? score.reason : null,
      updated_at: evaluatedAt,
    };

    if (score.archived) {
      patch.is_active = false;
      actionsQueued.push({
        type: "agent_archive",
        label: `Archived low-usefulness agent: ${score.name}`,
        status: "completed",
        targetId: score.agentId,
      });
    }

    batch.set(db.collection(COLLECTIONS.WORK_AGENTS).doc(score.agentId), patch, {
      merge: true,
    });
  }

  await batch.commit();
}

function buildBlockers(params: {
  integrations: Record<string, unknown>[];
  pairedDevices: Record<string, unknown>[];
  channelConnections: Record<string, unknown>[];
  sourceTasks: Record<string, unknown>[];
  runs: Record<string, unknown>[];
  clientAcquisition: boolean;
}) {
  const blockers: AutomatonBlocker[] = [];

  if (params.integrations.length === 0) {
    blockers.push({
      reason: "integrations_missing",
      detail: "No business integrations are connected, so Automaton can only prepare generic work.",
      severity: "warning",
      needsUser: true,
    });
  }

  if (params.pairedDevices.filter((device) => device.status !== "revoked").length === 0) {
    blockers.push({
      reason: "desktop_runtime_missing",
      detail: "No paired desktop runtime is available for local browser or desktop work.",
      severity: "info",
      needsUser: false,
    });
  }

  if (
    params.clientAcquisition &&
    params.channelConnections.filter((connection) => connection.status === "active").length === 0
  ) {
    blockers.push({
      reason: "outreach_channel_missing",
      detail: "Client acquisition can research and draft, but outreach needs an approved channel connection.",
      severity: "warning",
      needsUser: true,
    });
  }

  const pendingApprovals =
    params.sourceTasks.filter((task) => task.status === "awaiting_approval").length +
    params.runs.filter((run) => run.status === "awaiting_approval").length;
  if (pendingApprovals > 0) {
    blockers.push({
      reason: "approvals_pending",
      detail: `${pendingApprovals} Work item${pendingApprovals === 1 ? "" : "s"} need approval before Automaton can continue.`,
      severity: "warning",
      needsUser: true,
    });
  }

  return blockers;
}

async function createArtifact(
  db: Firestore,
  input: {
    userId: string;
    agentId?: string | null;
    runId?: string | null;
    title: string;
    payload: Record<string, unknown>;
  }
) {
  const timestamp = nowIso();
  const ref = db.collection(COLLECTIONS.WORK_ARTIFACTS).doc();
  const artifact = {
    user_id: input.userId,
    chat_id: null,
    agent_id: input.agentId ?? null,
    team_id: null,
    run_id: input.runId ?? null,
    title: input.title,
    artifact_type: "automation_log",
    payload: input.payload,
    created_at: timestamp,
    updated_at: timestamp,
  };
  await ref.set(artifact);
  return { id: ref.id, ...artifact };
}

export async function maybeRunAutomatonTarget(
  db: Firestore,
  run: WorkAutomationRun,
  task: string
): Promise<AutomatonOperatingOutput | null> {
  if (!run.agent_id) {
    return null;
  }

  const agentDoc = await db.collection(COLLECTIONS.WORK_AGENTS).doc(run.agent_id).get();
  const agentData = agentDoc.data();
  const agent = agentDoc.exists && agentData
    ? ({
        id: agentDoc.id,
        name: readString(agentData.name, "Agent"),
        source: agentData.source === "built_in" ? "built_in" : "custom",
        built_in_key: readString(agentData.built_in_key, "") || null,
      } as Pick<WorkAgent, "id" | "name" | "source" | "built_in_key">)
    : null;

  if (!isAutomatonAgentRecord(agent)) {
    return null;
  }

  await createAssistantAlertRecord({
    db,
    userId: run.user_id,
    projectId: run.project_id ?? null,
    title: "Automaton started",
    summary: "Automaton is running a gated operator cycle.",
    messageText: `Automaton started: ${task}`,
    severity: "info",
    source: "automaton",
  });

  try {
    const [
      agents,
      tasks,
      automations,
      runs,
      channels,
      sources,
      memories,
      integrations,
      pairedDevices,
      teams,
      teamMembers,
    ] = await Promise.all([
      loadUserDocs(db, COLLECTIONS.WORK_AGENTS, run.user_id),
      loadUserDocs(db, COLLECTIONS.WORK_TASKS, run.user_id),
      loadUserDocs(db, COLLECTIONS.WORK_SCHEDULED_AUTOMATIONS, run.user_id),
      loadUserDocs(db, COLLECTIONS.WORK_AUTOMATION_RUNS, run.user_id),
      loadUserDocs(db, COLLECTIONS.WORK_CHANNEL_CONNECTIONS, run.user_id),
      loadUserDocs(db, COLLECTIONS.WORK_SOURCE_TASKS, run.user_id),
      loadUserDocs(db, COLLECTIONS.MEMORIES, run.user_id),
      loadUserDocs(db, COLLECTIONS.INTEGRATIONS, run.user_id),
      loadUserDocs(db, COLLECTIONS.WORK_PAIRED_DEVICES, run.user_id),
      loadUserDocs(db, COLLECTIONS.WORK_AGENT_TEAMS, run.user_id),
      loadUserDocs(db, COLLECTIONS.WORK_TEAM_MEMBERS, run.user_id),
    ]);

    const clientAcquisition = isClientAcquisitionTask(task);
    const actionsQueued: AutomatonAction[] = [];

    if (clientAcquisition) {
      const sourceTask = await createSourceTask(db, run.user_id, {
        provider: "web",
        query: `Find likely client prospects and buying signals for: ${task}`,
        agentId: run.agent_id,
        autoExecuteEnabled: false,
        trustedScope: "none",
      });
      actionsQueued.push({
        type: "source_research",
        label: "Queued approval-gated prospect research",
        status: "queued",
        targetId: sourceTask?.id ?? null,
      });

      const followUpTask = await createWorkTask(db, run.user_id, {
        title: "Review Automaton prospect research",
        description:
          "Review the queued prospect research, approve browser fallback if needed, and choose outreach targets before any messages are sent.",
        priority: "high",
        agentId: run.agent_id,
        tags: ["automaton", "client-acquisition"],
      });
      actionsQueued.push({
        type: "task",
        label: "Created prospect review task",
        status: "queued",
        targetId: followUpTask.id,
      });
    }

    const activityByAgentId = buildActivityMap({
      agents,
      automations,
      automationRuns: runs,
      teams,
      teamMembers,
    });
    const agentScores = scoreWorkAgents({
      agents: agents.map((agentRecord) => ({
        id: readString(agentRecord.id, ""),
        name: readString(agentRecord.name, "Agent"),
        source: agentRecord.source === "built_in" ? "built_in" : "custom",
        built_in_key: readString(agentRecord.built_in_key, "") || null,
        is_active: agentRecord.is_active !== false,
        performance_score:
          typeof agentRecord.performance_score === "number"
            ? agentRecord.performance_score
            : null,
        low_score_streak:
          typeof agentRecord.low_score_streak === "number"
            ? agentRecord.low_score_streak
            : 0,
        updated_at: agentRecord.updated_at,
      })),
      activityByAgentId,
    });
    await persistAgentScores(db, agentScores, actionsQueued);

    const memoryResult = await saveMemoryRecord({
      adminDb: db,
      userId: run.user_id,
      content:
        "Automaton should run as a gated 24/7 operator: queue safe work, preserve approvals for sensitive actions, and report blockers through Maria and Work alerts.",
      memoryType: "context",
      importance: 8,
      tags: ["automaton", "operating-mode"],
    });
    if (memoryResult.created) {
      actionsQueued.push({
        type: "memory",
        label: "Stored Automaton operating-mode memory",
        status: "completed",
        targetId: memoryResult.id,
      });
    }

    const blockers = buildBlockers({
      integrations,
      pairedDevices,
      channelConnections: channels,
      sourceTasks: sources,
      runs,
      clientAcquisition,
    });
    const needsAssistance = blockers.some((blocker) => blocker.needsUser);
    const activeTaskCount = tasks.filter((item) => item.status !== "completed" && item.status !== "archived").length;
    const failedRunCount = runs.filter((item) => item.status === "failed").length;
    const summary = clientAcquisition
      ? "Automaton queued a gated client acquisition workflow and is waiting for approved research/outreach steps."
      : `Automaton checked the workspace: ${activeTaskCount} active task${activeTaskCount === 1 ? "" : "s"}, ${automations.length} automation${automations.length === 1 ? "" : "s"}, ${failedRunCount} failed run${failedRunCount === 1 ? "" : "s"}.`;
    const output: AutomatonOperatingOutput = {
      summary,
      actionsQueued,
      blockers,
      needsAssistance,
      agentScores,
      nextWatchItems: [
        "Pending approvals",
        "Failed or blocked runs",
        "Client acquisition research",
        "Agent usefulness trends",
      ],
      state: {
        tasks: latestDocs(tasks, 5),
        automations: latestDocs(automations, 5),
        runs: latestDocs(runs, 5),
        channels: latestDocs(channels, 5),
        sources: latestDocs(sources, 5),
        memories: latestDocs(memories, 5),
        integrations: integrations.length,
        pairedDevices: pairedDevices.length,
      },
    };

    const artifact = await createArtifact(db, {
      userId: run.user_id,
      agentId: run.agent_id,
      runId: run.id,
      title: "Automaton 24/7 operator log",
      payload: output,
    });
    output.artifactId = artifact.id;

    await createAssistantAlertRecord({
      db,
      userId: run.user_id,
      projectId: run.project_id ?? null,
      title: needsAssistance ? "Automaton needs help" : "Automaton cycle complete",
      summary: needsAssistance
        ? blockers.find((blocker) => blocker.needsUser)?.detail ?? summary
        : summary,
      messageText: `${summary}\n\nActions queued: ${actionsQueued.length}. Blockers: ${blockers.length}.`,
      severity: needsAssistance ? "warning" : "success",
      source: "automaton",
    });

    return output;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Automaton failure.";
    await createAssistantAlertRecord({
      db,
      userId: run.user_id,
      projectId: run.project_id ?? null,
      title: "Automaton failed",
      summary: message.slice(0, 140),
      messageText: `Automaton could not finish the operator cycle: ${message}`,
      severity: "warning",
      source: "automaton",
    });
    throw error;
  }
}
