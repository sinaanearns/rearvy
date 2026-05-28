import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS, type WorkDiaryEntry } from "@/lib/firebase/schema";

export type WorkDiaryInput = {
  entryDate?: unknown;
  title?: unknown;
  summary?: unknown;
  highlights?: unknown;
};

function nowIso() {
  return new Date().toISOString();
}

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function readString(value: unknown, fallback = "", maxLength = 4000) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : fallback;
}

function normalizeDateKey(value: unknown) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  return todayKey();
}

function normalizeHighlights(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim().slice(0, 300) : ""))
    .filter(Boolean)
    .slice(0, 20);
}

function docRecord(id: string, data: Record<string, unknown>) {
  return { id, ...data } as Record<string, unknown> & { id: string };
}

function timestampToString(value: unknown): string {
  if (typeof value === "string" && value) return value;
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return nowIso();
}

export function normalizeDiaryEntryDocument(id: string, data: Record<string, unknown>): WorkDiaryEntry {
  return {
    id,
    user_id: String(data.user_id || ""),
    entry_date: normalizeDateKey(data.entry_date),
    title: readString(data.title, "Daily work log", 180),
    summary: readString(data.summary, "", 8000),
    highlights: normalizeHighlights(data.highlights),
    metrics:
      data.metrics && typeof data.metrics === "object" && !Array.isArray(data.metrics)
        ? (data.metrics as Record<string, number>)
        : {},
    source_ids: Array.isArray(data.source_ids)
      ? data.source_ids.filter((item): item is string => typeof item === "string")
      : [],
    visibility: "private",
    created_at: timestampToString(data.created_at),
    updated_at: timestampToString(data.updated_at),
  };
}

export function buildDiarySummary(input: {
  completedTasks: Array<Record<string, unknown>>;
  completedRuns: Array<Record<string, unknown>>;
  sourceTasks: Array<Record<string, unknown>>;
}) {
  const highlights = [
    ...input.completedTasks.slice(0, 5).map((task) => `Completed task: ${readString(task.title, "Untitled task", 180)}`),
    ...input.completedRuns.slice(0, 5).map((run) => `Completed run: ${readString(run.task, readString(run.source, "Work run", 80), 180)}`),
    ...input.sourceTasks
      .filter((task) => task.status === "completed")
      .slice(0, 5)
      .map((task) => `Finished source research: ${readString(task.query, "Research task", 180)}`),
  ].slice(0, 10);

  const summary = highlights.length
    ? highlights.join(" ")
    : "No completed Work Platform activity was found for this date yet.";

  return {
    summary,
    highlights,
    metrics: {
      completedTasks: input.completedTasks.length,
      completedRuns: input.completedRuns.length,
      sourceTasks: input.sourceTasks.length,
    },
  };
}

async function collectDailyInputs(db: Firestore, userId: string, entryDate: string) {
  const [tasksSnapshot, runsSnapshot, sourcesSnapshot] = await Promise.all([
    db.collection(COLLECTIONS.WORK_TASKS).where("user_id", "==", userId).get(),
    db.collection(COLLECTIONS.WORK_AUTOMATION_RUNS).where("user_id", "==", userId).get(),
    db.collection(COLLECTIONS.WORK_SOURCE_TASKS).where("user_id", "==", userId).get(),
  ]);
  const sameDay = (value: unknown) => typeof value === "string" && value.startsWith(entryDate);
  return {
    completedTasks: tasksSnapshot.docs
      .map((doc) => docRecord(doc.id, doc.data()))
      .filter((task) => task.status === "completed" && sameDay(task.completed_at || task.updated_at)),
    completedRuns: runsSnapshot.docs
      .map((doc) => ({ ...docRecord(doc.id, doc.data()), source: "work_automation" }) as Record<string, unknown> & { id: string })
      .filter((run) => run.status === "completed" && sameDay(run.finished_at || run.updated_at)),
    sourceTasks: sourcesSnapshot.docs
      .map((doc) => docRecord(doc.id, doc.data()))
      .filter((task) => sameDay(task.finished_at || task.updated_at || task.created_at)),
  };
}

export async function listDiaryEntries(db: Firestore, userId: string, limit = 30) {
  const snapshot = await db
    .collection(COLLECTIONS.WORK_DIARY_ENTRIES)
    .where("user_id", "==", userId)
    .get();
  return snapshot.docs
    .map((doc) => normalizeDiaryEntryDocument(doc.id, doc.data()))
    .sort((left, right) => right.entry_date.localeCompare(left.entry_date))
    .slice(0, Math.min(Math.max(limit, 1), 100));
}

export async function createDiaryEntry(db: Firestore, userId: string, input: WorkDiaryInput) {
  const entryDate = normalizeDateKey(input.entryDate);
  const collected = await collectDailyInputs(db, userId, entryDate);
  const generated = buildDiarySummary(collected);
  const now = nowIso();
  const entry = {
    user_id: userId,
    entry_date: entryDate,
    title: readString(input.title, `Work log for ${entryDate}`, 180),
    summary: readString(input.summary, generated.summary, 8000),
    highlights:
      input.highlights === undefined
        ? generated.highlights
        : normalizeHighlights(input.highlights),
    metrics: generated.metrics,
    source_ids: [
      ...collected.completedTasks.map((task) => String(task.id)),
      ...collected.completedRuns.map((run) => String(run.id)),
      ...collected.sourceTasks.map((task) => String(task.id)),
    ].slice(0, 100),
    visibility: "private" as const,
    created_at: now,
    updated_at: now,
  };
  const docId = `${userId}_${entryDate}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 240);
  await db.collection(COLLECTIONS.WORK_DIARY_ENTRIES).doc(docId).set(entry, { merge: true });
  return { id: docId, ...entry };
}
