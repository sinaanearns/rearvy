import { adminDb } from "@/lib/firebase/admin";
import { createServerLogger } from "@/lib/server-logger";
import { getExecutor, UNSUPPORTED_CAPABILITIES } from "./executors";
import { planExecution } from "./planner";
import type {
  ExecutiveRequest,
  ExecutiveResult,
  StepRecord,
  ExecutionReport,
  StepStatus,
  ExecutionStep,
  ExecutorContext,
} from "./types";

const MAX_ATTEMPTS = 2;

const log = createServerLogger("Executive:Engine");

function buildStepRecord(step: ExecutionStep): StepRecord {
  return { ...step, status: "pending", attempts: 0 };
}

async function runStep(
  record: StepRecord,
  ctx: ExecutorContext,
  approvedStepIds?: string[],
): Promise<StepRecord> {
  const executor = getExecutor(record.capability);

  if (UNSUPPORTED_CAPABILITIES.has(record.capability) || !executor) {
    return {
      ...record,
      status: "unsupported",
      attempts: 1,
      result: {
        ok: false,
        status: "unsupported",
        detail: `Capability "${record.capability}" is planned but not yet wired into the execution engine.`,
      },
    };
  }

  if (record.requiresApproval && !(approvedStepIds ?? []).includes(record.id)) {
    return {
      ...record,
      status: "skipped",
      attempts: 0,
      result: {
        ok: false,
        status: "skipped",
        detail: "Waiting for user approval before executing this step.",
        needsApproval: true,
      },
    };
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const result = await executor(record, ctx);
      if (result.ok) {
        return {
          ...record,
          status: attempt > 1 ? "recovered" : "succeeded",
          attempts: attempt,
          result,
        };
      }
      if (attempt < MAX_ATTEMPTS) continue;
      return { ...record, status: "failed", attempts: attempt, result, error: result.detail };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown executor error";
      if (attempt < MAX_ATTEMPTS) continue; // recover: automatic retry
      return { ...record, status: "failed", attempts: attempt, error: message };
    }
  }
  return { ...record, status: "failed", attempts: MAX_ATTEMPTS };
}

function summarize(
  goal: string,
  steps: StepRecord[],
): ExecutionReport {
  const byStatus = (s: StepStatus) => steps.filter((x) => x.status === s).length;
  const completed = byStatus("succeeded") + byStatus("recovered");
  const failed = byStatus("failed");
  const recovered = byStatus("recovered");
  const skipped = byStatus("skipped") + byStatus("unsupported");

  const notes: string[] = [];
  const unsupported = steps.filter((s) => s.status === "unsupported");
  if (unsupported.length) {
    notes.push(
      `Pending capabilities: ${unsupported.map((s) => s.capability).join(", ")}. Wire these into the engine to complete the goal autonomously.`,
    );
  }
  const awaiting = steps.filter((s) => s.status === "skipped" && s.result?.needsApproval);
  if (awaiting.length) {
    notes.push(`${awaiting.length} step(s) awaiting your approval.`);
  }

  const allDone = failed === 0 && unsupported.length === 0 && awaiting.length === 0;
  const summary = allDone
    ? `Completed "${goal}".`
    : `Partially executed "${goal}": ${completed} done, ${failed} failed, ${skipped} not run.`;

  return {
    goal,
    summary,
    completed,
    failed,
    recovered,
    skipped,
    steps: steps.map((s) => ({
      intent: s.intent,
      status: s.status,
      detail: s.result?.detail ?? s.error ?? "",
    })),
    learned: false,
    notes,
  };
}

export async function runExecutiveRequest(
  req: ExecutiveRequest,
): Promise<ExecutiveResult> {
  const plan = await planExecution(req);
  const ctx: ExecutorContext = {
    userId: req.userId,
    projectId: req.projectId ?? null,
    adminDb,
    isDesktopApp: req.isDesktopApp ?? false,
  };

  const records: StepRecord[] = plan.steps.map((s) => buildStepRecord(s));
  for (const record of records) {
    const updated = await runStep(record, ctx, req.approvedStepIds);
    Object.assign(record, updated);
  }

  const report = summarize(req.request, records);

  // Learn: persist a successful, fully-wired workflow as a reusable playbook.
  const executable = records.filter(
    (r) => r.status === "succeeded" || r.status === "recovered",
  );
  const pending = records.filter(
    (r) => r.status === "unsupported" || r.status === "skipped",
  );
  if (executable.length > 0 && pending.length === 0) {
    try {
      const { ingestDocument } = await import("@/lib/knowledge/ingestion-pipeline");
      await ingestDocument({
        userId: ctx.userId,
        projectId: ctx.projectId ?? null,
        title: `Playbook: ${req.request}`,
        sourceType: "text",
        sourceIdentifier: "executive-engine",
        text: [
          `Goal: ${req.request}`,
          `Assumptions: ${plan.assumptions.join("; ")}`,
          "Steps:",
          ...plan.steps.map(
            (s, i) => `${i + 1}. [${s.capability}] ${s.intent} -> ${JSON.stringify(s.params)}`,
          ),
        ].join("\n"),
      });
      report.learned = true;
    } catch (error) {
      log.error("Failed to persist executed workflow as a playbook", {
        userId: ctx.userId,
        projectId: ctx.projectId ?? null,
        error: error instanceof Error ? error.message : String(error),
      });
      report.notes.push("Workflow succeeded but could not be saved to memory.");
    }
  }

  return { understood: plan.understood, plan, steps: records, report };
}
