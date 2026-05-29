import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { safeDocId } from "@/lib/firebase/doc-utils";
import type { AgentEvent, AgentEventSource, AgentEventType } from "./types";

export type EnqueueAgentEventInput = {
  userId: string;
  projectId?: string | null;
  type: AgentEventType;
  source: AgentEventSource;
  payload?: Record<string, unknown>;
  dedupeKey?: string | null;
  priority?: number;
  maxAttempts?: number;
  nextRunAt?: string;
};

export type EnqueueAgentEventResult = {
  eventId: string;
  deduped: boolean;
};

export type RunPendingAgentEventsOptions = {
  userId?: string;
  limit?: number;
};

export type RunPendingAgentEventsResult = {
  processed: number;
  succeeded: number;
  failed: number;
};

export function buildAgentEventDocId(params: {
  userId: string;
  type: AgentEventType;
  dedupeKey?: string | null;
}) {
  const sourceKey =
    params.dedupeKey && params.dedupeKey.trim()
      ? params.dedupeKey
      : `${params.type}:${crypto.randomUUID()}`;

  return safeDocId(params.userId, sourceKey).slice(0, 240);
}

export function calculateNextRetryAt(
  attemptCount: number,
  maxAttempts: number,
  nowMs = Date.now()
) {
  if (attemptCount >= maxAttempts) {
    return null;
  }

  const delayMinutes = Math.min(2 ** Math.max(attemptCount - 1, 0), 60);
  return new Date(nowMs + delayMinutes * 60 * 1000).toISOString();
}

function clampPriority(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return 5;
  }

  return Math.min(Math.max(Math.floor(value as number), 1), 10);
}

function normalizePayload(value: Record<string, unknown> | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value;
}

export function isRunnableAgentEvent(
  event: AgentEvent,
  nowIso: string,
  userId?: string
) {
  if (event.status !== "pending" && event.status !== "failed") {
    return false;
  }

  if (userId && event.user_id !== userId) {
    return false;
  }

  if (event.attempt_count >= event.max_attempts) {
    return false;
  }

  return typeof event.next_run_at === "string" && event.next_run_at <= nowIso;
}

export async function enqueueAgentEvent(
  adminDb: Firestore,
  input: EnqueueAgentEventInput
): Promise<EnqueueAgentEventResult> {
  const eventId = buildAgentEventDocId({
    userId: input.userId,
    type: input.type,
    dedupeKey: input.dedupeKey,
  });
  const eventRef = adminDb.collection(COLLECTIONS.AGENT_EVENTS).doc(eventId);
  const existing = await eventRef.get();

  if (existing.exists) {
    return { eventId, deduped: true };
  }

  const nowIso = new Date().toISOString();
  const event: AgentEvent = {
    id: eventId,
    user_id: input.userId,
    project_id: input.projectId ?? null,
    type: input.type,
    source: input.source,
    dedupe_key: input.dedupeKey ?? null,
    priority: clampPriority(input.priority),
    status: "pending",
    payload: normalizePayload(input.payload),
    attempt_count: 0,
    max_attempts: Math.min(Math.max(input.maxAttempts || 5, 1), 10),
    next_run_at: input.nextRunAt ?? nowIso,
    last_error: null,
    created_at: nowIso,
    updated_at: nowIso,
  };

  await eventRef.set(event);
  return { eventId, deduped: false };
}

async function processEvent(adminDb: Firestore, event: AgentEvent) {
  if (event.type === "automation_trigger") {
    const { processWorkAutomationEvent } = await import("@/lib/work/runtime");
    return processWorkAutomationEvent(adminDb, event);
  }

  if (event.type === "anomaly" || event.type === "metric_change") {
    return {
      summary:
        "Metric change captured. Insights can be generated from cached business data before any LLM call.",
      nextStep: "Use tool-first analysis and route to AI only when configured.",
    };
  }

  return {
    summary: "Event acknowledged by the work event queue.",
    nextStep:
      "The queue remains idle until another user request, webhook, schedule, anomaly, or approved automation event arrives.",
  };
}

export async function runPendingAgentEvents(
  adminDb: Firestore,
  options: RunPendingAgentEventsOptions = {}
): Promise<RunPendingAgentEventsResult> {
  const nowIso = new Date().toISOString();
  const limit = Math.min(Math.max(options.limit || 5, 1), 25);
  const candidateLimit = Math.min(Math.max(limit * 8, 25), 100);
  const snapshot = await adminDb
    .collection(COLLECTIONS.AGENT_EVENTS)
    .where("next_run_at", "<=", nowIso)
    .orderBy("next_run_at", "asc")
    .limit(candidateLimit)
    .get();

  const events = snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as AgentEvent)
    .filter((event) => isRunnableAgentEvent(event, nowIso, options.userId))
    .sort((left, right) => {
      const priorityDiff = left.priority - right.priority;
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return left.next_run_at.localeCompare(right.next_run_at);
    })
    .slice(0, limit);

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const event of events) {
    const eventRef = adminDb.collection(COLLECTIONS.AGENT_EVENTS).doc(event.id);
    const runId = crypto.randomUUID();
    const runRef = adminDb.collection(COLLECTIONS.AGENT_RUNS).doc(runId);
    const startedAt = new Date().toISOString();

    const claimedEvent = await adminDb.runTransaction(async (transaction) => {
      const currentSnapshot = await transaction.get(eventRef);
      const currentData = currentSnapshot.data();
      if (!currentSnapshot.exists || !currentData) {
        return null;
      }

      const currentEvent = { id: currentSnapshot.id, ...currentData } as AgentEvent;
      if (!isRunnableAgentEvent(currentEvent, nowIso, options.userId)) {
        return null;
      }

      const nextAttempt = currentEvent.attempt_count + 1;
      transaction.update(eventRef, {
        status: "processing",
        attempt_count: nextAttempt,
        updated_at: startedAt,
        last_error: null,
      });
      transaction.set(runRef, {
        id: runId,
        user_id: currentEvent.user_id,
        project_id: currentEvent.project_id ?? null,
        event_id: currentEvent.id,
        trigger_type: currentEvent.type,
        status: "running",
        model_route: null,
        tools_used: [],
        approval_state: "not_required",
        output: null,
        usage: null,
        error: null,
        started_at: startedAt,
        finished_at: null,
        created_at: startedAt,
        updated_at: startedAt,
      });

      return {
        ...currentEvent,
        status: "processing" as const,
        attempt_count: nextAttempt,
        updated_at: startedAt,
        last_error: null,
      };
    });

    if (!claimedEvent) {
      continue;
    }

    processed++;

    try {
      const output = await processEvent(adminDb, claimedEvent);
      const finishedAt = new Date().toISOString();

      await runRef.update({
        status: "completed",
        output,
        finished_at: finishedAt,
        updated_at: finishedAt,
      });
      await eventRef.update({
        status: "completed",
        next_run_at: null,
        last_error: null,
        updated_at: finishedAt,
      });
      succeeded++;
    } catch (error) {
      failed++;

      const message =
        error instanceof Error ? error.message : "Unknown agent event failure";
      const finishedAt = new Date().toISOString();
      const nextRunAt = calculateNextRetryAt(
        claimedEvent.attempt_count,
        claimedEvent.max_attempts
      );

      await runRef.update({
        status: "failed",
        error: message.slice(0, 1000),
        finished_at: finishedAt,
        updated_at: finishedAt,
      });
      await eventRef.update({
        status: "failed",
        last_error: message.slice(0, 1000),
        next_run_at: nextRunAt,
        updated_at: finishedAt,
      });
    }
  }

  return {
    processed,
    succeeded,
    failed,
  };
}
