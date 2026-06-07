import type { Firestore } from "firebase-admin/firestore";
import {
  COLLECTIONS,
  type WorkListener,
  type WorkSourceProvider,
  type WorkTrustedScope,
} from "@/lib/firebase/schema";
import { enqueueAgentEvent } from "@/lib/agent-events/store";
import { safeDocId } from "@/lib/firebase/doc-utils";
import { createServerLogger } from "@/lib/server-logger";
import { createSourceTask } from "./sources";
import { createWorkTask } from "./tasks";
import { getNextCronRunAt, normalizeWorkSchedule } from "./schedule";
import { canAutoExecute, normalizeAutoExecute, normalizeTrustedScope } from "./trusted";

const log = createServerLogger("WorkListeners");

export type WorkListenerInput = {
  name?: unknown;
  description?: unknown;
  provider?: unknown;
  query?: unknown;
  schedule?: unknown;
  timezone?: unknown;
  action?: unknown;
  config?: unknown;
  status?: unknown;
  autoExecuteEnabled?: unknown;
  trustedScope?: unknown;
};

type ListenerRunResult = {
  checked: number;
  matched: number;
  action: WorkListener["action"];
  output: Record<string, unknown>;
};

const PROVIDERS = new Set<WorkListener["provider"]>(["gmail", "channel", "source", "webhook"]);
const ACTIONS = new Set<WorkListener["action"]>([
  "notify",
  "create_task",
  "run_source",
  "sync_gmail",
  "enqueue_event",
]);
const SOURCE_PROVIDERS = new Set<WorkSourceProvider>([
  "reddit",
  "tiktok",
  "alibaba",
  "aliexpress",
  "1688",
  "shopify",
  "youtube",
  "instagram",
  "facebook",
  "github",
  "web",
]);

function nowIso() {
  return new Date().toISOString();
}

function readString(value: unknown, fallback = "", maxLength = 2000) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : fallback;
}

function readNullableString(value: unknown, maxLength = 2000) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
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

function nullableIso(value: unknown) {
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

function normalizeProvider(value: unknown): WorkListener["provider"] {
  return typeof value === "string" && PROVIDERS.has(value as WorkListener["provider"])
    ? (value as WorkListener["provider"])
    : "source";
}

function normalizeAction(value: unknown, provider: WorkListener["provider"]): WorkListener["action"] {
  if (typeof value === "string" && ACTIONS.has(value as WorkListener["action"])) {
    return value as WorkListener["action"];
  }
  if (provider === "gmail") return "sync_gmail";
  if (provider === "source") return "run_source";
  return "create_task";
}

function normalizeStatus(value: unknown): WorkListener["status"] {
  return value === "paused" || value === "error" || value === "archived" ? value : "active";
}

function estimateNextRunAt(schedule: string, timezone: string, now = new Date()) {
  try {
    return getNextCronRunAt(schedule, timezone, now);
  } catch {
    return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  }
}

function normalizeSourceProvider(value: unknown): WorkSourceProvider {
  return typeof value === "string" && SOURCE_PROVIDERS.has(value as WorkSourceProvider)
    ? (value as WorkSourceProvider)
    : "web";
}

export function doesRecordMatchQuery(record: Record<string, unknown>, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return false;
  return JSON.stringify(record).toLowerCase().includes(normalizedQuery);
}

export function shouldRunListenerAutomatically(listener: {
  auto_execute_enabled?: boolean;
  trusted_scope?: WorkTrustedScope | string | null;
}) {
  return canAutoExecute({
    autoExecuteEnabled: listener.auto_execute_enabled,
    trustedScope: listener.trusted_scope,
  });
}

export function normalizeWorkListenerDocument(id: string, data: Record<string, unknown>): WorkListener {
  const provider = normalizeProvider(data.provider);
  return {
    id,
    user_id: String(data.user_id || ""),
    name: readString(data.name, "Work listener", 140),
    description: readNullableString(data.description, 1000),
    provider,
    query: readString(data.query, "", 1000),
    status: normalizeStatus(data.status),
    schedule: readString(data.schedule, "0 * * * *", 80),
    schedule_label: readString(data.schedule_label, readString(data.schedule, "0 * * * *", 80), 120),
    timezone: readString(data.timezone, "UTC", 80),
    next_run_at: nullableIso(data.next_run_at),
    last_run_at: nullableIso(data.last_run_at),
    last_match_at: nullableIso(data.last_match_at),
    match_count: Number.isFinite(Number(data.match_count)) ? Number(data.match_count) : 0,
    auto_execute_enabled: Boolean(data.auto_execute_enabled),
    trusted_scope: normalizeTrustedScope(data.trusted_scope),
    last_auto_executed_at: nullableIso(data.last_auto_executed_at),
    action: normalizeAction(data.action, provider),
    config: safeRecord(data.config),
    error: readNullableString(data.error, 1000),
    created_at: timestampToString(data.created_at),
    updated_at: timestampToString(data.updated_at),
  };
}

export function normalizeWorkListenerInput(
  input: WorkListenerInput,
  existing?: WorkListener
): Omit<WorkListener, "id"> {
  const provider = normalizeProvider(input.provider ?? existing?.provider);
  const scheduleInfo = normalizeWorkSchedule(input.schedule ?? existing?.schedule ?? "hourly");
  const timezone = readString(input.timezone, existing?.timezone || "UTC", 80);
  const now = nowIso();
  return {
    user_id: existing?.user_id || "",
    name: readString(input.name, existing?.name || "Work listener", 140),
    description: readNullableString(input.description ?? existing?.description, 1000),
    provider,
    query: readString(input.query, existing?.query || "", 1000),
    status: normalizeStatus(input.status ?? existing?.status),
    schedule: scheduleInfo.schedule,
    schedule_label: scheduleInfo.label,
    timezone,
    next_run_at: estimateNextRunAt(scheduleInfo.schedule, timezone),
    last_run_at: existing?.last_run_at || null,
    last_match_at: existing?.last_match_at || null,
    match_count: existing?.match_count || 0,
    auto_execute_enabled: normalizeAutoExecute(
      input.autoExecuteEnabled,
      existing?.auto_execute_enabled || false
    ),
    trusted_scope: normalizeTrustedScope(input.trustedScope ?? existing?.trusted_scope),
    last_auto_executed_at: existing?.last_auto_executed_at || null,
    action: normalizeAction(input.action ?? existing?.action, provider),
    config: input.config === undefined ? existing?.config || {} : safeRecord(input.config),
    error: null,
    created_at: existing?.created_at || now,
    updated_at: now,
  };
}

export async function listWorkListeners(db: Firestore, userId: string, limit = 100) {
  const snapshot = await db.collection(COLLECTIONS.WORK_LISTENERS).where("user_id", "==", userId).get();
  return snapshot.docs
    .map((doc) => normalizeWorkListenerDocument(doc.id, doc.data()))
    .sort((left, right) => String(right.updated_at).localeCompare(String(left.updated_at)))
    .slice(0, Math.min(Math.max(limit, 1), 200));
}

export async function createWorkListener(db: Firestore, userId: string, input: WorkListenerInput) {
  const listener = { ...normalizeWorkListenerInput(input), user_id: userId };
  if (!listener.query) {
    throw new Error("Listener query is required.");
  }
  const ref = db.collection(COLLECTIONS.WORK_LISTENERS).doc();
  await ref.set(listener);
  return { id: ref.id, ...listener };
}

export async function getWorkListener(db: Firestore, userId: string, listenerId: string) {
  const snapshot = await db.collection(COLLECTIONS.WORK_LISTENERS).doc(listenerId).get();
  const data = snapshot.data();
  if (!snapshot.exists || !data) return null;
  const listener = normalizeWorkListenerDocument(snapshot.id, data);
  return listener.user_id === userId ? listener : null;
}

export async function updateWorkListener(
  db: Firestore,
  userId: string,
  listenerId: string,
  input: WorkListenerInput
) {
  const existing = await getWorkListener(db, userId, listenerId);
  if (!existing) return null;
  const patch = normalizeWorkListenerInput(input, existing);
  await db.collection(COLLECTIONS.WORK_LISTENERS).doc(listenerId).set(patch, { merge: true });
  return { id: listenerId, ...patch };
}

export async function archiveWorkListener(db: Firestore, userId: string, listenerId: string) {
  return updateWorkListener(db, userId, listenerId, { status: "archived" });
}

async function scanCollectionForMatches(
  db: Firestore,
  collection: string,
  userId: string,
  query: string,
  limit = 100
) {
  const snapshot = await db.collection(collection).where("user_id", "==", userId).get();
  const records: Record<string, unknown>[] = snapshot.docs
    .map((doc): Record<string, unknown> => ({ id: doc.id, ...doc.data() }))
    .sort((left, right) =>
      String(right.created_at || right.updated_at || "").localeCompare(
        String(left.created_at || left.updated_at || "")
      )
    )
    .slice(0, limit);
  return {
    checked: records.length,
    matches: records.filter((record) => doesRecordMatchQuery(record, query)).slice(0, 10),
  };
}

async function performListenerAction(
  db: Firestore,
  listener: WorkListener,
  matches: Record<string, unknown>[]
): Promise<ListenerRunResult> {
  if (listener.action === "run_source" || listener.provider === "source") {
    const sourceProvider = normalizeSourceProvider(
      listener.config.sourceProvider ?? listener.config.provider
    );
    const task = await createSourceTask(db, listener.user_id, {
      provider: sourceProvider,
      query: listener.query,
      autoExecuteEnabled: listener.auto_execute_enabled,
      trustedScope: listener.trusted_scope,
      agentId: listener.config.agentId,
      teamId: listener.config.teamId,
    });
    return {
      checked: 1,
      matched: task ? 1 : 0,
      action: "run_source",
      output: { sourceTaskId: task?.id || null, sourceProvider, status: task?.status || null },
    };
  }

  if (listener.action === "create_task" && matches.length > 0) {
    const task = await createWorkTask(db, listener.user_id, {
      title: `${listener.name}: ${listener.query}`,
      description: `Listener matched ${matches.length} record(s).`,
      priority: "normal",
      tags: ["listener", listener.provider],
    });
    return {
      checked: matches.length,
      matched: matches.length,
      action: "create_task",
      output: { taskId: task.id, sampleIds: matches.map((match) => match.id).filter(Boolean) },
    };
  }

  if (listener.action === "sync_gmail") {
    const event = await enqueueAgentEvent(db, {
      userId: listener.user_id,
      type: "schedule",
      source: "schedule",
      payload: {
        listenerId: listener.id,
        provider: "gmail",
        query: listener.query,
        matchIds: matches.map((match) => match.id).filter(Boolean),
      },
      dedupeKey: `listener:${listener.id}:gmail:${nowIso().slice(0, 16)}`,
      priority: matches.length ? 4 : 7,
      maxAttempts: 3,
    });
    return {
      checked: matches.length,
      matched: matches.length,
      action: "sync_gmail",
      output: { eventId: event.eventId, deduped: event.deduped },
    };
  }

  if (listener.action === "enqueue_event" || listener.provider === "webhook") {
    const event = await enqueueAgentEvent(db, {
      userId: listener.user_id,
      type: "webhook",
      source: "webhook",
      payload: {
        listenerId: listener.id,
        query: listener.query,
        matches,
      },
      dedupeKey: `listener:${listener.id}:webhook:${nowIso().slice(0, 16)}`,
      priority: 5,
      maxAttempts: 3,
    });
    return {
      checked: matches.length,
      matched: matches.length,
      action: "enqueue_event",
      output: { eventId: event.eventId, deduped: event.deduped },
    };
  }

  return {
    checked: matches.length,
    matched: matches.length,
    action: "notify",
    output: { sampleIds: matches.map((match) => match.id).filter(Boolean) },
  };
}

export async function runWorkListener(db: Firestore, userId: string, listenerId: string) {
  const listener = await getWorkListener(db, userId, listenerId);
  if (!listener) return null;
  const ref = db.collection(COLLECTIONS.WORK_LISTENERS).doc(listener.id);
  const startedAt = nowIso();

  try {
    let checked = 0;
    let matches: Record<string, unknown>[] = [];
    if (listener.provider === "gmail") {
      const result = await scanCollectionForMatches(db, COLLECTIONS.GMAIL_MESSAGES, userId, listener.query);
      checked = result.checked;
      matches = result.matches;
    } else if (listener.provider === "channel") {
      const result = await scanCollectionForMatches(
        db,
        COLLECTIONS.WORK_CHANNEL_MESSAGES,
        userId,
        listener.query
      );
      checked = result.checked;
      matches = result.matches;
    } else if (listener.provider === "webhook") {
      matches = [{ id: listener.id, query: listener.query, triggered_at: startedAt }];
      checked = 1;
    }

    const actionResult = await performListenerAction(db, listener, matches);
    const matched = listener.provider === "source" ? actionResult.matched : matches.length;
    const nextRunAt = estimateNextRunAt(listener.schedule, listener.timezone);
    const updatedAt = nowIso();
    await ref.set(
      {
        status: "active",
        last_run_at: startedAt,
        last_match_at: matched > 0 ? updatedAt : listener.last_match_at,
        match_count: (listener.match_count || 0) + matched,
        next_run_at: nextRunAt,
        last_auto_executed_at: shouldRunListenerAutomatically(listener) ? updatedAt : listener.last_auto_executed_at,
        error: null,
        updated_at: updatedAt,
      },
      { merge: true }
    );
    return {
      ...listener,
      checked: checked || actionResult.checked,
      matched,
      output: actionResult.output,
      last_run_at: startedAt,
      next_run_at: nextRunAt,
      updated_at: updatedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Listener run failed.";
    const updatedAt = nowIso();
    await ref.set(
      {
        status: "error",
        error: message.slice(0, 1000),
        last_run_at: startedAt,
        updated_at: updatedAt,
      },
      { merge: true }
    );
    throw error;
  }
}

export async function scanDueWorkListeners(
  db: Firestore,
  options: { limit?: number; now?: Date } = {}
) {
  const now = options.now ?? new Date();
  const nowText = now.toISOString();
  const limit = Math.min(Math.max(options.limit || 25, 1), 100);
  const snapshot = await db.collection(COLLECTIONS.WORK_LISTENERS).where("status", "==", "active").get();
  const due = snapshot.docs
    .map((doc) => normalizeWorkListenerDocument(doc.id, doc.data()))
    .filter((listener) => Boolean(listener.next_run_at))
    .filter((listener) => String(listener.next_run_at) <= nowText)
    .sort((left, right) => String(left.next_run_at || "").localeCompare(String(right.next_run_at || "")))
    .slice(0, limit);

  let ran = 0;
  let deduped = 0;
  let skippedUntrusted = 0;
  let failed = 0;

  for (const listener of due) {
    if (!shouldRunListenerAutomatically(listener)) {
      skippedUntrusted += 1;
      continue;
    }

    const leaseId = safeDocId(listener.id, listener.next_run_at || nowText).slice(0, 240);
    const leaseRef = db.collection(COLLECTIONS.WORK_SCHEDULER_LEASES).doc(leaseId);
    const leaseSnapshot = await leaseRef.get();
    if (leaseSnapshot.exists) {
      deduped += 1;
      continue;
    }

    try {
      await leaseRef.create({
        owner_id: "work-listener-scheduler",
        status: "active",
        expires_at: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
        created_at: nowText,
        updated_at: nowText,
      });
      await runWorkListener(db, listener.user_id, listener.id);
      ran += 1;
    } catch (error) {
      failed += 1;
      log.error("Failed to run due Work listener:", error);
    }
  }

  return {
    scanned: due.length,
    ran,
    deduped,
    skippedUntrusted,
    failed,
  };
}
