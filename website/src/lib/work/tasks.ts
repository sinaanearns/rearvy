import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS, type WorkTask } from "@/lib/firebase/schema";

export type WorkTaskInput = {
  title?: unknown;
  description?: unknown;
  status?: unknown;
  priority?: unknown;
  projectId?: unknown;
  agentId?: unknown;
  dueAt?: unknown;
  tags?: unknown;
};

function nowIso() {
  return new Date().toISOString();
}

function readString(value: unknown, fallback = "", maxLength = 1000) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : fallback;
}

function readNullableString(value: unknown, maxLength = 1000) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : null;
}

function normalizeTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim().slice(0, 40) : ""))
        .filter(Boolean)
    )
  ).slice(0, 20);
}

function normalizeStatus(value: unknown, fallback: WorkTask["status"]): WorkTask["status"] {
  return value === "in_progress" ||
    value === "completed" ||
    value === "archived" ||
    value === "pending"
    ? value
    : fallback;
}

function normalizePriority(value: unknown, fallback: WorkTask["priority"]): WorkTask["priority"] {
  return value === "low" || value === "high" || value === "normal" ? value : fallback;
}

function toIsoOrNull(value: unknown) {
  if (!value) return null;
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }
  if (value instanceof Date) return value.toISOString();
  return null;
}

function timestampToString(value: unknown): string {
  if (typeof value === "string" && value) return value;
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return nowIso();
}

export function normalizeWorkTaskDocument(id: string, data: Record<string, unknown>): WorkTask {
  return {
    id,
    user_id: String(data.user_id || ""),
    title: readString(data.title, "Untitled task", 180),
    description: readNullableString(data.description, 4000),
    status: normalizeStatus(data.status, "pending"),
    priority: normalizePriority(data.priority, "normal"),
    project_id: readNullableString(data.project_id, 200),
    agent_id: readNullableString(data.agent_id, 200),
    due_at: toIsoOrNull(data.due_at),
    tags: normalizeTags(data.tags),
    source:
      data.source === "automation" || data.source === "listener" ? data.source : "manual",
    completed_at: toIsoOrNull(data.completed_at),
    archived_at: toIsoOrNull(data.archived_at),
    created_at: timestampToString(data.created_at),
    updated_at: timestampToString(data.updated_at),
  };
}

export function normalizeWorkTaskInput(input: WorkTaskInput, existing?: WorkTask): Omit<WorkTask, "id"> {
  const now = nowIso();
  const nextStatus = normalizeStatus(input.status, existing?.status || "pending");
  const wasCompleted = existing?.status === "completed";
  const isCompleted = nextStatus === "completed";
  const isArchived = nextStatus === "archived";

  return {
    user_id: existing?.user_id || "",
    title: readString(input.title, existing?.title || "Untitled task", 180),
    description: readNullableString(input.description ?? existing?.description, 4000),
    status: nextStatus,
    priority: normalizePriority(input.priority, existing?.priority || "normal"),
    project_id: readNullableString(input.projectId ?? existing?.project_id, 200),
    agent_id: readNullableString(input.agentId ?? existing?.agent_id, 200),
    due_at: toIsoOrNull(input.dueAt ?? existing?.due_at),
    tags: input.tags === undefined ? existing?.tags || [] : normalizeTags(input.tags),
    source: existing?.source || "manual",
    completed_at: isCompleted ? existing?.completed_at || now : wasCompleted ? existing?.completed_at || null : null,
    archived_at: isArchived ? existing?.archived_at || now : existing?.archived_at || null,
    created_at: existing?.created_at || now,
    updated_at: now,
  };
}

export async function listWorkTasks(db: Firestore, userId: string, limit = 100) {
  const snapshot = await db.collection(COLLECTIONS.WORK_TASKS).where("user_id", "==", userId).get();
  return snapshot.docs
    .map((doc) => normalizeWorkTaskDocument(doc.id, doc.data()))
    .sort((left, right) => String(right.updated_at).localeCompare(String(left.updated_at)))
    .slice(0, Math.min(Math.max(limit, 1), 200));
}

export async function createWorkTask(db: Firestore, userId: string, input: WorkTaskInput) {
  const ref = db.collection(COLLECTIONS.WORK_TASKS).doc();
  const task = {
    ...normalizeWorkTaskInput(input),
    user_id: userId,
  };
  await ref.set(task);
  return { id: ref.id, ...task };
}

export async function getWorkTask(db: Firestore, userId: string, taskId: string) {
  const snapshot = await db.collection(COLLECTIONS.WORK_TASKS).doc(taskId).get();
  const data = snapshot.data();
  if (!snapshot.exists || !data) return null;
  const task = normalizeWorkTaskDocument(snapshot.id, data);
  return task.user_id === userId ? task : null;
}

export async function updateWorkTask(
  db: Firestore,
  userId: string,
  taskId: string,
  input: WorkTaskInput
) {
  const existing = await getWorkTask(db, userId, taskId);
  if (!existing) return null;
  const patch = normalizeWorkTaskInput(input, existing);
  await db.collection(COLLECTIONS.WORK_TASKS).doc(taskId).set(patch, { merge: true });
  return { id: taskId, ...patch };
}

export async function archiveWorkTask(db: Firestore, userId: string, taskId: string) {
  return updateWorkTask(db, userId, taskId, { status: "archived" });
}
