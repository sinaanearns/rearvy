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

async function processEvent(event: AgentEvent) {
  if (event.type === "automation_trigger") {
    return {
      summary:
        "Operations runtime acknowledged the automation trigger and queued safe policy evaluation.",
      nextStep:
        "Layer 2+ actions require approval unless the user's policy explicitly allows low-risk automation.",
    };
  }

  if (event.type === "anomaly" || event.type === "metric_change") {
    return {
      summary:
        "Metric change captured. Insights can be generated from cached business data before any LLM call.",
      nextStep: "Use tool-first analysis and route to AI only when configured.",
    };
  }

  return {
    summary: "Event acknowledged by the Business Ops Runtime.",
    nextStep:
      "The runtime remains asleep until another user request, webhook, schedule, anomaly, or approved automation event arrives.",
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
    .filter((event) => event.status === "pending" || event.status === "failed")
    .filter((event) => (options.userId ? event.user_id === options.userId : true))
    .sort((left, right) => {
      const priorityDiff = left.priority - right.priority;
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return left.next_run_at.localeCompare(right.next_run_at);
    })
    .slice(0, limit);

  let succeeded = 0;
  let failed = 0;

  for (const event of events) {
    const nextAttempt = event.attempt_count + 1;
    const eventRef = adminDb.collection(COLLECTIONS.AGENT_EVENTS).doc(event.id);
    const runId = crypto.randomUUID();
    const runRef = adminDb.collection(COLLECTIONS.AGENT_RUNS).doc(runId);
    const startedAt = new Date().toISOString();

    await eventRef.update({
      status: "processing",
      attempt_count: nextAttempt,
      updated_at: startedAt,
      last_error: null,
    });
    await runRef.set({
      id: runId,
      user_id: event.user_id,
      project_id: event.project_id ?? null,
      event_id: event.id,
      trigger_type: event.type,
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

    try {
      const output = await processEvent({
        ...event,
        attempt_count: nextAttempt,
      });
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
      const nextRunAt = calculateNextRetryAt(nextAttempt, event.max_attempts);

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
    processed: events.length,
    succeeded,
    failed,
  };
}
