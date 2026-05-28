import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS, type WorkProcessSession } from "@/lib/firebase/schema";
import { queueLocalWorkJob } from "./pairing";
import { canAutoExecute, normalizeAutoExecute, normalizeTrustedScope } from "./trusted";

export type WorkProcessInput = {
  command?: unknown;
  cwd?: unknown;
  deviceId?: unknown;
  autoExecuteEnabled?: unknown;
  trustedScope?: unknown;
};

function nowIso() {
  return new Date().toISOString();
}

function readString(value: unknown, fallback = "", maxLength = 4000) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : fallback;
}

function readNullableString(value: unknown, maxLength = 1000) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : null;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.slice(0, 2000) : ""))
    .filter(Boolean)
    .slice(-200);
}

function timestampToString(value: unknown): string {
  if (typeof value === "string" && value) return value;
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return nowIso();
}

function nullableIso(value: unknown) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return null;
}

function normalizeStatus(value: unknown): WorkProcessSession["status"] {
  return value === "running" ||
    value === "completed" ||
    value === "failed" ||
    value === "canceled"
    ? value
    : "queued";
}

export function normalizeProcessSessionDocument(
  id: string,
  data: Record<string, unknown>
): WorkProcessSession {
  return {
    id,
    user_id: String(data.user_id || ""),
    device_id: readNullableString(data.device_id, 200),
    command: readString(data.command, "", 4000),
    cwd: readNullableString(data.cwd, 1000),
    status: normalizeStatus(data.status),
    auto_execute_enabled: Boolean(data.auto_execute_enabled),
    trusted_scope: normalizeTrustedScope(data.trusted_scope),
    last_auto_executed_at: nullableIso(data.last_auto_executed_at),
    stdout: normalizeStringArray(data.stdout),
    stderr: normalizeStringArray(data.stderr),
    exit_code: Number.isFinite(Number(data.exit_code)) ? Number(data.exit_code) : null,
    local_job_id: readNullableString(data.local_job_id, 200),
    error: readNullableString(data.error, 1000),
    created_at: timestampToString(data.created_at),
    updated_at: timestampToString(data.updated_at),
    started_at: nullableIso(data.started_at),
    finished_at: nullableIso(data.finished_at),
  };
}

export function normalizeProcessSessionInput(
  input: WorkProcessInput,
  existing?: WorkProcessSession
): Omit<WorkProcessSession, "id"> {
  const now = nowIso();
  return {
    user_id: existing?.user_id || "",
    device_id: readNullableString(input.deviceId ?? existing?.device_id, 200),
    command: readString(input.command, existing?.command || "", 4000),
    cwd: readNullableString(input.cwd ?? existing?.cwd, 1000),
    status: existing?.status || "queued",
    auto_execute_enabled: normalizeAutoExecute(
      input.autoExecuteEnabled,
      existing?.auto_execute_enabled || false
    ),
    trusted_scope: normalizeTrustedScope(input.trustedScope ?? existing?.trusted_scope),
    last_auto_executed_at: existing?.last_auto_executed_at || null,
    stdout: existing?.stdout || [],
    stderr: existing?.stderr || [],
    exit_code: existing?.exit_code ?? null,
    local_job_id: existing?.local_job_id || null,
    error: null,
    created_at: existing?.created_at || now,
    updated_at: now,
    started_at: existing?.started_at || null,
    finished_at: existing?.finished_at || null,
  };
}

export function processCanStart(session: Pick<WorkProcessSession, "auto_execute_enabled" | "trusted_scope">) {
  return canAutoExecute({
    autoExecuteEnabled: session.auto_execute_enabled,
    trustedScope: session.trusted_scope,
  });
}

async function queueProcessExecution(db: Firestore, session: WorkProcessSession) {
  const job = await queueLocalWorkJob(db, {
    userId: session.user_id,
    deviceId: session.device_id,
    runId: session.id,
    jobType: "terminal",
    payload: {
      action: "start",
      processSessionId: session.id,
      command: session.command,
      cwd: session.cwd,
    },
  });
  const now = nowIso();
  const patch = {
    status: "running" as const,
    local_job_id: job.id,
    started_at: session.started_at || now,
    last_auto_executed_at: now,
    stdout: [...session.stdout, `Queued terminal job ${job.id}.`].slice(-200),
    updated_at: now,
  };
  await db.collection(COLLECTIONS.WORK_PROCESS_SESSIONS).doc(session.id).set(patch, { merge: true });
  return { ...session, ...patch };
}

export async function listProcessSessions(db: Firestore, userId: string, limit = 50) {
  const snapshot = await db
    .collection(COLLECTIONS.WORK_PROCESS_SESSIONS)
    .where("user_id", "==", userId)
    .get();
  return snapshot.docs
    .map((doc) => normalizeProcessSessionDocument(doc.id, doc.data()))
    .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))
    .slice(0, Math.min(Math.max(limit, 1), 100));
}

export async function createProcessSession(db: Firestore, userId: string, input: WorkProcessInput) {
  const sessionData = { ...normalizeProcessSessionInput(input), user_id: userId };
  if (!sessionData.command) {
    throw new Error("Process command is required.");
  }
  const ref = db.collection(COLLECTIONS.WORK_PROCESS_SESSIONS).doc();
  const session = { id: ref.id, ...sessionData };
  await ref.set(sessionData);
  return processCanStart(session) ? queueProcessExecution(db, session) : session;
}

export async function getProcessSession(db: Firestore, userId: string, processId: string) {
  const snapshot = await db.collection(COLLECTIONS.WORK_PROCESS_SESSIONS).doc(processId).get();
  const data = snapshot.data();
  if (!snapshot.exists || !data) return null;
  const session = normalizeProcessSessionDocument(snapshot.id, data);
  return session.user_id === userId ? session : null;
}

export async function updateProcessSession(
  db: Firestore,
  userId: string,
  processId: string,
  input: WorkProcessInput & { action?: unknown }
) {
  const existing = await getProcessSession(db, userId, processId);
  if (!existing) return null;

  if (input.action === "approve" || input.action === "start") {
    return queueProcessExecution(db, {
      ...existing,
      auto_execute_enabled: true,
      trusted_scope: "trusted",
    });
  }

  const patch = normalizeProcessSessionInput(input, existing);
  await db.collection(COLLECTIONS.WORK_PROCESS_SESSIONS).doc(processId).set(patch, { merge: true });
  return { id: processId, ...patch };
}

export async function queueProcessInput(
  db: Firestore,
  userId: string,
  processId: string,
  text: string
) {
  const session = await getProcessSession(db, userId, processId);
  if (!session) return null;
  if (!session.local_job_id) {
    throw new Error("Process has not been claimed by a local runtime.");
  }
  const job = await queueLocalWorkJob(db, {
    userId,
    deviceId: session.device_id,
    runId: session.id,
    jobType: "terminal",
    payload: {
      action: "input",
      processSessionId: session.id,
      localJobId: session.local_job_id,
      text: text.slice(0, 4000),
    },
  });
  const stdout = [...session.stdout, `Queued stdin job ${job.id}.`].slice(-200);
  const now = nowIso();
  await db.collection(COLLECTIONS.WORK_PROCESS_SESSIONS).doc(session.id).set(
    { stdout, updated_at: now },
    { merge: true }
  );
  return { ...session, stdout, updated_at: now };
}

export async function stopProcessSession(db: Firestore, userId: string, processId: string) {
  const session = await getProcessSession(db, userId, processId);
  if (!session) return null;
  if (session.local_job_id) {
    await queueLocalWorkJob(db, {
      userId,
      deviceId: session.device_id,
      runId: session.id,
      jobType: "terminal",
      payload: {
        action: "stop",
        processSessionId: session.id,
        localJobId: session.local_job_id,
      },
    });
  }
  const now = nowIso();
  const patch = {
    status: "canceled" as const,
    stderr: [...session.stderr, "Stop requested."].slice(-200),
    finished_at: now,
    updated_at: now,
  };
  await db.collection(COLLECTIONS.WORK_PROCESS_SESSIONS).doc(session.id).set(patch, { merge: true });
  return { ...session, ...patch };
}

export async function completeProcessSessionFromLocalJob(
  db: Firestore,
  userId: string,
  job: {
    id: string;
    status?: string;
    result?: Record<string, unknown> | null;
    error?: string | null;
    payload?: Record<string, unknown>;
  }
) {
  const processSessionId =
    typeof job.payload?.processSessionId === "string" ? job.payload.processSessionId : null;
  if (!processSessionId) return null;
  const session = await getProcessSession(db, userId, processSessionId);
  if (!session) return null;

  const stdout = normalizeStringArray(job.result?.stdout);
  const stderr = normalizeStringArray(job.result?.stderr);
  const exitCode = Number.isFinite(Number(job.result?.exitCode)) ? Number(job.result?.exitCode) : null;
  const nextStatus =
    job.status === "failed" || job.error || (exitCode !== null && exitCode !== 0)
      ? "failed"
      : job.status === "canceled"
        ? "canceled"
        : "completed";
  const now = nowIso();
  const patch = {
    status: nextStatus as WorkProcessSession["status"],
    stdout: stdout.length ? stdout : session.stdout,
    stderr: stderr.length ? stderr : session.stderr,
    exit_code: exitCode,
    error: job.error ?? null,
    finished_at: now,
    updated_at: now,
  };
  await db.collection(COLLECTIONS.WORK_PROCESS_SESSIONS).doc(session.id).set(patch, { merge: true });
  return { ...session, ...patch };
}
