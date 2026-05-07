import type { Firestore } from "firebase-admin/firestore";
import {
  COLLECTIONS,
  type PythonSandboxApprovalState,
  type PythonSandboxRiskLevel,
  type PythonSandboxRun,
  type PythonSandboxRunArtifact,
  type PythonSandboxRunStatus,
  type PythonSandboxScript,
} from "@/lib/firebase/schema";

export type PythonSandboxRuntimeConfig = {
  allowNetwork?: boolean;
  maxRuntimeSeconds?: number;
  maxMemoryMb?: number;
  allowedDataScopes?: string[];
};

export type CreatePythonSandboxScriptInput = {
  name: string;
  description?: string | null;
  code: string;
  entrypoint?: string | null;
  approvalState?: Exclude<PythonSandboxApprovalState, "archived">;
  allowedDataScopes?: string[];
  allowNetwork?: boolean;
  maxRuntimeSeconds?: number;
  maxMemoryMb?: number;
  tags?: string[];
};

export type UpdatePythonSandboxScriptInput = {
  name?: string;
  description?: string | null;
  code?: string;
  entrypoint?: string | null;
  approvalState?: PythonSandboxApprovalState;
  allowedDataScopes?: string[];
  allowNetwork?: boolean;
  maxRuntimeSeconds?: number;
  maxMemoryMb?: number;
  tags?: string[];
};

export type QueuePythonSandboxRunInput = {
  scriptId?: string | null;
  scriptName?: string | null;
  code?: string | null;
  input?: Record<string, unknown>;
  runtime?: PythonSandboxRuntimeConfig;
  approvalRequired?: boolean;
  requestedBy?: string | null;
};

export type ListPythonSandboxRunsOptions = {
  limit?: number;
  scriptId?: string | null;
  status?: PythonSandboxRunStatus | "all";
};

type FirestoreTimestampLike = {
  toDate?: () => Date;
};

const DEFAULT_ALLOWED_DATA_SCOPES: string[] = [];
const DEFAULT_RUNTIME_SECONDS = 120;
const DEFAULT_MEMORY_MB = 512;
const MAX_RUNTIME_SECONDS = 900;
const MAX_MEMORY_MB = 2048;

function nowIso() {
  return new Date().toISOString();
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.floor(value), min), max);
}

function toIsoString(value: unknown): string {
  if (!value) return nowIso();
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const candidate = (value as FirestoreTimestampLike).toDate;
    if (typeof candidate === "function") {
      return candidate().toISOString();
    }
  }
  return nowIso();
}

function normalizeStringArray(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) return [...fallback];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
}

function normalizeRuntimeConfig(
  runtime?: PythonSandboxRuntimeConfig,
  fallback?: {
    allowNetwork: boolean;
    maxRuntimeSeconds: number;
    maxMemoryMb: number;
    allowedDataScopes: string[];
  }
) {
  return {
    allowNetwork: runtime?.allowNetwork ?? fallback?.allowNetwork ?? false,
    maxRuntimeSeconds: clampNumber(
      runtime?.maxRuntimeSeconds ?? fallback?.maxRuntimeSeconds ?? DEFAULT_RUNTIME_SECONDS,
      1,
      MAX_RUNTIME_SECONDS
    ),
    maxMemoryMb: clampNumber(
      runtime?.maxMemoryMb ?? fallback?.maxMemoryMb ?? DEFAULT_MEMORY_MB,
      64,
      MAX_MEMORY_MB
    ),
    allowedDataScopes: normalizeStringArray(
      runtime?.allowedDataScopes,
      fallback?.allowedDataScopes ?? DEFAULT_ALLOWED_DATA_SCOPES
    ),
  };
}

function normalizeScriptDocument(
  docId: string,
  data: Record<string, unknown>
): PythonSandboxScript {
  return {
    id: docId,
    user_id: String(data.user_id || ""),
    name: String(data.name || "Untitled script"),
    description:
      typeof data.description === "string" && data.description.length > 0
        ? data.description
        : null,
    code: String(data.code || ""),
    language: "python",
    entrypoint:
      typeof data.entrypoint === "string" && data.entrypoint.length > 0
        ? data.entrypoint
        : null,
    version:
      typeof data.version === "number" && Number.isFinite(data.version)
        ? data.version
        : 1,
    approval_state:
      data.approval_state === "approved" ||
      data.approval_state === "archived"
        ? data.approval_state
        : "draft",
    allowed_data_scopes: normalizeStringArray(data.allowed_data_scopes),
    allow_network: Boolean(data.allow_network),
    max_runtime_seconds: clampNumber(
      typeof data.max_runtime_seconds === "number"
        ? data.max_runtime_seconds
        : Number(data.max_runtime_seconds || DEFAULT_RUNTIME_SECONDS),
      1,
      MAX_RUNTIME_SECONDS
    ),
    max_memory_mb: clampNumber(
      typeof data.max_memory_mb === "number"
        ? data.max_memory_mb
        : Number(data.max_memory_mb || DEFAULT_MEMORY_MB),
      64,
      MAX_MEMORY_MB
    ),
    created_by:
      typeof data.created_by === "string" && data.created_by.length > 0
        ? data.created_by
        : null,
    last_run_at: typeof data.last_run_at === "string" ? data.last_run_at : null,
    last_run_status:
      data.last_run_status === "queued" ||
      data.last_run_status === "awaiting_approval" ||
      data.last_run_status === "running" ||
      data.last_run_status === "completed" ||
      data.last_run_status === "failed" ||
      data.last_run_status === "canceled"
        ? data.last_run_status
        : null,
    tags: normalizeStringArray(data.tags),
    created_at: toIsoString(data.created_at),
    updated_at: toIsoString(data.updated_at),
  };
}

function normalizeRunArtifacts(value: unknown): PythonSandboxRunArtifact[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const artifact = entry as Record<string, unknown>;
      const name = typeof artifact.name === "string" ? artifact.name.trim() : "";
      const path = typeof artifact.path === "string" ? artifact.path.trim() : "";

      if (!name || !path) return null;

      return {
        name,
        path,
        content_type:
          typeof artifact.content_type === "string" && artifact.content_type.length > 0
            ? artifact.content_type
            : null,
        size_bytes:
          typeof artifact.size_bytes === "number" && Number.isFinite(artifact.size_bytes)
            ? artifact.size_bytes
            : null,
      } satisfies PythonSandboxRunArtifact;
    })
    .filter((entry): entry is PythonSandboxRunArtifact => Boolean(entry));
}

function normalizeRunDocument(
  docId: string,
  data: Record<string, unknown>
): PythonSandboxRun {
  return {
    id: docId,
    user_id: String(data.user_id || ""),
    script_id:
      typeof data.script_id === "string" && data.script_id.length > 0
        ? data.script_id
        : null,
    script_name:
      typeof data.script_name === "string" && data.script_name.length > 0
        ? data.script_name
        : null,
    source: data.source === "script" ? "script" : "adhoc",
    code: String(data.code || ""),
    input:
      data.input && typeof data.input === "object" && !Array.isArray(data.input)
        ? (data.input as Record<string, unknown>)
        : {},
    status:
      data.status === "queued" ||
      data.status === "awaiting_approval" ||
      data.status === "running" ||
      data.status === "completed" ||
      data.status === "failed" ||
      data.status === "canceled"
        ? data.status
        : "queued",
    approval_required: Boolean(data.approval_required),
    risk_level:
      data.risk_level === "low" ||
      data.risk_level === "medium" ||
      data.risk_level === "high"
        ? data.risk_level
        : "low",
    allow_network: Boolean(data.allow_network),
    max_runtime_seconds: clampNumber(
      typeof data.max_runtime_seconds === "number"
        ? data.max_runtime_seconds
        : Number(data.max_runtime_seconds || DEFAULT_RUNTIME_SECONDS),
      1,
      MAX_RUNTIME_SECONDS
    ),
    max_memory_mb: clampNumber(
      typeof data.max_memory_mb === "number"
        ? data.max_memory_mb
        : Number(data.max_memory_mb || DEFAULT_MEMORY_MB),
      64,
      MAX_MEMORY_MB
    ),
    allowed_data_scopes: normalizeStringArray(data.allowed_data_scopes),
    requested_by:
      typeof data.requested_by === "string" && data.requested_by.length > 0
        ? data.requested_by
        : null,
    result: data.result ?? null,
    error:
      typeof data.error === "string" && data.error.length > 0
        ? data.error
        : null,
    stdout: normalizeStringArray(data.stdout),
    stderr: normalizeStringArray(data.stderr),
    artifacts: normalizeRunArtifacts(data.artifacts),
    started_at:
      typeof data.started_at === "string" && data.started_at.length > 0
        ? data.started_at
        : null,
    finished_at:
      typeof data.finished_at === "string" && data.finished_at.length > 0
        ? data.finished_at
        : null,
    created_at: toIsoString(data.created_at),
    updated_at: toIsoString(data.updated_at),
  };
}

function buildScriptDefaults(input: CreatePythonSandboxScriptInput) {
  const runtime = normalizeRuntimeConfig(
    {
      allowNetwork: input.allowNetwork,
      maxRuntimeSeconds: input.maxRuntimeSeconds,
      maxMemoryMb: input.maxMemoryMb,
      allowedDataScopes: input.allowedDataScopes,
    },
    {
      allowNetwork: false,
      maxRuntimeSeconds: DEFAULT_RUNTIME_SECONDS,
      maxMemoryMb: DEFAULT_MEMORY_MB,
      allowedDataScopes: DEFAULT_ALLOWED_DATA_SCOPES,
    }
  );

  return {
    name: input.name.trim(),
    description:
      typeof input.description === "string" && input.description.trim().length > 0
        ? input.description.trim()
        : null,
    code: input.code,
    entrypoint:
      typeof input.entrypoint === "string" && input.entrypoint.trim().length > 0
        ? input.entrypoint.trim()
        : null,
    approval_state: input.approvalState ?? "draft",
    allowed_data_scopes: runtime.allowedDataScopes,
    allow_network: runtime.allowNetwork,
    max_runtime_seconds: runtime.maxRuntimeSeconds,
    max_memory_mb: runtime.maxMemoryMb,
    tags: normalizeStringArray(input.tags),
  };
}

function buildRunRiskLevel(
  approvalRequired: boolean,
  allowNetwork: boolean
): PythonSandboxRiskLevel {
  if (approvalRequired) return "high";
  if (allowNetwork) return "medium";
  return "low";
}

export async function listPythonSandboxScripts(
  db: Firestore,
  userId: string,
  options: { approvalState?: PythonSandboxApprovalState | "all"; limit?: number } = {}
): Promise<PythonSandboxScript[]> {
  const snapshot = await db
    .collection(COLLECTIONS.PYTHON_SANDBOX_SCRIPTS)
    .where("user_id", "==", userId)
    .get();

  let scripts = snapshot.docs.map((doc) =>
    normalizeScriptDocument(doc.id, doc.data() as Record<string, unknown>)
  );

  if (options.approvalState && options.approvalState !== "all") {
    scripts = scripts.filter((script) => script.approval_state === options.approvalState);
  }

  scripts.sort((left, right) => right.updated_at.localeCompare(left.updated_at));

  if (options.limit && Number.isFinite(options.limit)) {
    return scripts.slice(0, Math.max(1, Math.floor(options.limit)));
  }

  return scripts;
}

export async function getPythonSandboxScript(
  db: Firestore,
  userId: string,
  scriptId: string
): Promise<PythonSandboxScript | null> {
  const doc = await db.collection(COLLECTIONS.PYTHON_SANDBOX_SCRIPTS).doc(scriptId).get();
  if (!doc.exists) return null;

  const script = normalizeScriptDocument(doc.id, doc.data() as Record<string, unknown>);
  if (script.user_id !== userId) return null;
  return script;
}

export async function createPythonSandboxScript(
  db: Firestore,
  userId: string,
  input: CreatePythonSandboxScriptInput
): Promise<PythonSandboxScript> {
  const docRef = db.collection(COLLECTIONS.PYTHON_SANDBOX_SCRIPTS).doc();
  const now = nowIso();
  const defaults = buildScriptDefaults(input);
  const script: PythonSandboxScript = {
    id: docRef.id,
    user_id: userId,
    name: defaults.name,
    description: defaults.description,
    code: defaults.code,
    language: "python",
    entrypoint: defaults.entrypoint,
    version: 1,
    approval_state: defaults.approval_state,
    allowed_data_scopes: defaults.allowed_data_scopes,
    allow_network: defaults.allow_network,
    max_runtime_seconds: defaults.max_runtime_seconds,
    max_memory_mb: defaults.max_memory_mb,
    created_by: userId,
    last_run_at: null,
    last_run_status: null,
    tags: defaults.tags,
    created_at: now,
    updated_at: now,
  };

  await docRef.set(script);
  return script;
}

export async function updatePythonSandboxScript(
  db: Firestore,
  userId: string,
  scriptId: string,
  input: UpdatePythonSandboxScriptInput
): Promise<PythonSandboxScript | null> {
  const docRef = db.collection(COLLECTIONS.PYTHON_SANDBOX_SCRIPTS).doc(scriptId);
  const snapshot = await docRef.get();

  if (!snapshot.exists) return null;

  const current = normalizeScriptDocument(
    snapshot.id,
    snapshot.data() as Record<string, unknown>
  );

  if (current.user_id !== userId) return null;

  const next: PythonSandboxScript = {
    ...current,
    name: input.name !== undefined ? input.name.trim() : current.name,
    description:
      input.description !== undefined
        ? typeof input.description === "string" && input.description.trim().length > 0
          ? input.description.trim()
          : null
        : current.description,
    code: input.code !== undefined ? input.code : current.code,
    entrypoint:
      input.entrypoint !== undefined
        ? typeof input.entrypoint === "string" && input.entrypoint.trim().length > 0
          ? input.entrypoint.trim()
          : null
        : current.entrypoint,
    approval_state: input.approvalState ?? current.approval_state,
    allowed_data_scopes:
      input.allowedDataScopes !== undefined
        ? normalizeStringArray(input.allowedDataScopes)
        : current.allowed_data_scopes,
    allow_network:
      input.allowNetwork !== undefined ? input.allowNetwork : current.allow_network,
    max_runtime_seconds:
      input.maxRuntimeSeconds !== undefined
        ? clampNumber(input.maxRuntimeSeconds, 1, MAX_RUNTIME_SECONDS)
        : current.max_runtime_seconds,
    max_memory_mb:
      input.maxMemoryMb !== undefined
        ? clampNumber(input.maxMemoryMb, 64, MAX_MEMORY_MB)
        : current.max_memory_mb,
    version: current.version + 1,
    tags: input.tags !== undefined ? normalizeStringArray(input.tags) : current.tags,
    updated_at: nowIso(),
  };

  await docRef.set(next, { merge: true });
  return next;
}

export async function archivePythonSandboxScript(
  db: Firestore,
  userId: string,
  scriptId: string
): Promise<PythonSandboxScript | null> {
  return updatePythonSandboxScript(db, userId, scriptId, {
    approvalState: "archived",
  });
}

export async function listPythonSandboxRuns(
  db: Firestore,
  userId: string,
  options: ListPythonSandboxRunsOptions = {}
): Promise<PythonSandboxRun[]> {
  const snapshot = await db
    .collection(COLLECTIONS.PYTHON_SANDBOX_RUNS)
    .where("user_id", "==", userId)
    .get();

  let runs = snapshot.docs.map((doc) =>
    normalizeRunDocument(doc.id, doc.data() as Record<string, unknown>)
  );

  if (options.scriptId) {
    runs = runs.filter((run) => run.script_id === options.scriptId);
  }

  if (options.status && options.status !== "all") {
    runs = runs.filter((run) => run.status === options.status);
  }

  runs.sort((left, right) => right.created_at.localeCompare(left.created_at));

  const limit = options.limit && Number.isFinite(options.limit) ? Math.max(1, Math.floor(options.limit)) : 50;
  return runs.slice(0, limit);
}

export async function getPythonSandboxRun(
  db: Firestore,
  userId: string,
  runId: string
): Promise<PythonSandboxRun | null> {
  const doc = await db.collection(COLLECTIONS.PYTHON_SANDBOX_RUNS).doc(runId).get();
  if (!doc.exists) return null;

  const run = normalizeRunDocument(doc.id, doc.data() as Record<string, unknown>);
  if (run.user_id !== userId) return null;
  return run;
}

export async function queuePythonSandboxRun(
  db: Firestore,
  userId: string,
  input: QueuePythonSandboxRunInput
): Promise<PythonSandboxRun> {
  const script = input.scriptId
    ? await getPythonSandboxScript(db, userId, input.scriptId)
    : null;

  if (input.scriptId && !script) {
    throw new Error("Python sandbox script not found.");
  }

  const code = script ? script.code : (input.code || "");
  if (!code.trim()) {
    throw new Error("Python code is required to queue a sandbox run.");
  }

  const runtime = normalizeRuntimeConfig(input.runtime, script
    ? {
        allowNetwork: script.allow_network,
        maxRuntimeSeconds: script.max_runtime_seconds,
        maxMemoryMb: script.max_memory_mb,
        allowedDataScopes: script.allowed_data_scopes,
      }
    : {
        allowNetwork: false,
        maxRuntimeSeconds: DEFAULT_RUNTIME_SECONDS,
        maxMemoryMb: DEFAULT_MEMORY_MB,
        allowedDataScopes: DEFAULT_ALLOWED_DATA_SCOPES,
      });

  const approvalRequired = input.approvalRequired ?? (script ? script.approval_state !== "approved" : true);
  const status: PythonSandboxRunStatus = approvalRequired ? "awaiting_approval" : "queued";
  const riskLevel = buildRunRiskLevel(approvalRequired, runtime.allowNetwork);
  const now = nowIso();
  const runRef = db.collection(COLLECTIONS.PYTHON_SANDBOX_RUNS).doc();
  const run: PythonSandboxRun = {
    id: runRef.id,
    user_id: userId,
    script_id: script?.id ?? null,
    script_name: script?.name ?? input.scriptName?.trim() ?? null,
    source: script ? "script" : "adhoc",
    code,
    input: input.input ?? {},
    status,
    approval_required: approvalRequired,
    risk_level: riskLevel,
    allow_network: runtime.allowNetwork,
    max_runtime_seconds: runtime.maxRuntimeSeconds,
    max_memory_mb: runtime.maxMemoryMb,
    allowed_data_scopes: runtime.allowedDataScopes,
    requested_by: input.requestedBy ?? userId,
    result: null,
    error: null,
    stdout: [],
    stderr: [],
    artifacts: [],
    started_at: null,
    finished_at: null,
    created_at: now,
    updated_at: now,
  };

  const batch = db.batch();
  batch.set(runRef, run);

  if (script) {
    const scriptRef = db.collection(COLLECTIONS.PYTHON_SANDBOX_SCRIPTS).doc(script.id);
    batch.set(
      scriptRef,
      {
        last_run_at: now,
        last_run_status: status,
        updated_at: now,
      },
      { merge: true }
    );
  }

  await batch.commit();
  return run;
}

export async function cancelPythonSandboxRun(
  db: Firestore,
  userId: string,
  runId: string
): Promise<PythonSandboxRun | null> {
  const docRef = db.collection(COLLECTIONS.PYTHON_SANDBOX_RUNS).doc(runId);
  const snapshot = await docRef.get();

  if (!snapshot.exists) return null;

  const current = normalizeRunDocument(
    snapshot.id,
    snapshot.data() as Record<string, unknown>
  );

  if (current.user_id !== userId) return null;

  if (current.status === "completed" || current.status === "failed" || current.status === "canceled") {
    return current;
  }

  const next: PythonSandboxRun = {
    ...current,
    status: "canceled",
    finished_at: nowIso(),
    updated_at: nowIso(),
  };

  await docRef.set(next, { merge: true });
  return next;
}
