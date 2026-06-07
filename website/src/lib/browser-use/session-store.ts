/**
 * File-based browser session store.
 *
 * Writes session metadata to the OS temp directory so that every Next.js API
 * route (which may be in separate Turbopack module bundles) can read/write
 * session state without relying on a shared in-memory singleton.
 *
 * Uses atomic writes (write-to-temp-then-rename) to prevent corruption
 * from concurrent access and Turbopack module isolation.
 */

import fs from "fs";
import path from "path";
import os from "os";
import { isRecord } from "@/lib/api/request-body";
import { parseJsonRecord } from "@/lib/ai/json-object";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("BrowserSessionStore");

const SESSIONS_DIR = path.join(os.tmpdir(), "rearvy-browser-sessions");
const IS_VERCEL = Boolean(process.env.VERCEL);
const LOCK_WAIT_MS = 100;
const MAX_LOCK_WAIT_ATTEMPTS = 10;

function ensureDir() {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

function getLockFile(id: string): string {
  return path.join(SESSIONS_DIR, `${id}.lock`);
}

function waitForLock(id: string, attempts = 0): void {
  const lockFile = getLockFile(id);
  if (fs.existsSync(lockFile) && attempts < MAX_LOCK_WAIT_ATTEMPTS) {
    // Sleep briefly then retry
    const now = Date.now();
    while (Date.now() - now < LOCK_WAIT_MS) {
      // Busy wait (intentional for cross-process synchronization)
    }
    waitForLock(id, attempts + 1);
  }
}

function releaseLock(id: string): void {
  try {
    const lockFile = getLockFile(id);
    if (fs.existsSync(lockFile)) {
      fs.unlinkSync(lockFile);
    }
  } catch (error) {
    log.debug("Failed to release browser session lock:", error);
    // Ignore lock cleanup errors
  }
}

export type PersistedSession = {
  id: string;
  task: string;
  createdAt: number;
  userId?: string;
  dedupeKey?: string | null;
  strategy?: "goal-seeking" | "open-only";
  connectionMethod?: "cdp-direct" | "extension-relay" | "managed-runner";
  connectionStatus?: string | null;
  connectedBrowser?: {
    name?: string | null;
    version?: string | null;
    webSocketDebuggerUrl?: string | null;
  } | null;
  extensionRelay?: {
    port?: number | null;
    commandId?: string | null;
    extensionId?: string | null;
  } | null;
  stdout: string[];
  stderr: string[];
  isRunning: boolean;
  pid?: number;
  status?: string;
  currentUrl?: string | null;
  title?: string | null;
  summary?: string | null;
  screenshotDataUrl?: string | null;
  setupError?: string | null;
  awaitingApproval?: {
    id?: string;
    reason?: string;
    command?: string | null;
  } | null;
  actionLog?: Array<{
    id: string;
    action: string;
    status: string;
    message: string;
    timestamp: string;
  }>;
  exitCode?: number | null;
  exitedAt?: number | null;
};

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function optionalStringOrNull(value: unknown): string | null | undefined {
  return value === null || value === undefined
    ? value
    : typeof value === "string"
      ? value
      : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function optionalNumberOrNull(value: unknown): number | null | undefined {
  return value === null || value === undefined
    ? value
    : typeof value === "number" && Number.isFinite(value)
      ? value
      : undefined;
}

function optionalStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizeConnectedBrowser(value: unknown): PersistedSession["connectedBrowser"] {
  if (value === null || value === undefined) return value;
  if (!isRecord(value)) return undefined;
  return {
    name: optionalStringOrNull(value.name),
    version: optionalStringOrNull(value.version),
    webSocketDebuggerUrl: optionalStringOrNull(value.webSocketDebuggerUrl),
  };
}

function normalizeExtensionRelay(value: unknown): PersistedSession["extensionRelay"] {
  if (value === null || value === undefined) return value;
  if (!isRecord(value)) return undefined;
  return {
    port: optionalNumberOrNull(value.port),
    commandId: optionalStringOrNull(value.commandId),
    extensionId: optionalStringOrNull(value.extensionId),
  };
}

function normalizeAwaitingApproval(value: unknown): PersistedSession["awaitingApproval"] {
  if (value === null || value === undefined) return value;
  if (!isRecord(value)) return undefined;
  return {
    id: optionalString(value.id),
    reason: optionalString(value.reason),
    command: optionalStringOrNull(value.command),
  };
}

function normalizeActionLog(value: unknown): PersistedSession["actionLog"] {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter(isRecord)
    .map((entry) => ({
      id: optionalString(entry.id) || "",
      action: optionalString(entry.action) || "event",
      status: optionalString(entry.status) || "running",
      message: optionalString(entry.message) || "",
      timestamp: optionalString(entry.timestamp) || new Date().toISOString(),
    }))
    .filter((entry) => entry.id);
}

export function parsePersistedSession(raw: string): PersistedSession | null {
  const parsed = parseJsonRecord(raw);
  if (!parsed) return null;

  const id = optionalString(parsed.id)?.trim();
  const task = optionalString(parsed.task)?.trim();
  const createdAt = optionalNumber(parsed.createdAt);
  if (!id || !task || createdAt === undefined) {
    return null;
  }

  return {
    id,
    task,
    createdAt,
    userId: optionalString(parsed.userId),
    dedupeKey: optionalStringOrNull(parsed.dedupeKey),
    strategy:
      parsed.strategy === "goal-seeking" || parsed.strategy === "open-only"
        ? parsed.strategy
        : undefined,
    connectionMethod:
      parsed.connectionMethod === "cdp-direct" ||
      parsed.connectionMethod === "extension-relay" ||
      parsed.connectionMethod === "managed-runner"
        ? parsed.connectionMethod
        : undefined,
    connectionStatus: optionalStringOrNull(parsed.connectionStatus),
    connectedBrowser: normalizeConnectedBrowser(parsed.connectedBrowser),
    extensionRelay: normalizeExtensionRelay(parsed.extensionRelay),
    stdout: optionalStringArray(parsed.stdout),
    stderr: optionalStringArray(parsed.stderr),
    isRunning: parsed.isRunning === true,
    pid: optionalNumber(parsed.pid),
    status: optionalString(parsed.status),
    currentUrl: optionalStringOrNull(parsed.currentUrl),
    title: optionalStringOrNull(parsed.title),
    summary: optionalStringOrNull(parsed.summary),
    screenshotDataUrl: optionalStringOrNull(parsed.screenshotDataUrl),
    setupError: optionalStringOrNull(parsed.setupError),
    awaitingApproval: normalizeAwaitingApproval(parsed.awaitingApproval),
    actionLog: normalizeActionLog(parsed.actionLog),
    exitCode: optionalNumberOrNull(parsed.exitCode),
    exitedAt: optionalNumberOrNull(parsed.exitedAt),
  };
}

export function writeSession(data: PersistedSession): void {
  // Avoid writing files in serverless/edge environments (e.g. Vercel)
  if (IS_VERCEL) return;

  ensureDir();
  waitForLock(data.id);

  try {
    const lockFile = getLockFile(data.id);
    fs.writeFileSync(lockFile, "", "utf8");

    // Write to temp file first, then atomically rename
    const filePath = path.join(SESSIONS_DIR, `${data.id}.json`);
    const tempPath = `${filePath}.tmp`;

    fs.writeFileSync(tempPath, JSON.stringify(data), "utf8");
    fs.renameSync(tempPath, filePath); // Atomic rename
  } catch (error) {
    log.error("Failed to write session:", { sessionId: data.id, error });
    // Non-fatal - in-memory store is still the source of truth.
  } finally {
    releaseLock(data.id);
  }
}

export function readSession(id: string): PersistedSession | null {
  if (IS_VERCEL) return null;

  waitForLock(id);

  try {
    const lockFile = getLockFile(id);
    fs.writeFileSync(lockFile, "", "utf8");

    const filePath = path.join(SESSIONS_DIR, `${id}.json`);
    if (!fs.existsSync(filePath)) return null;

    return parsePersistedSession(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    log.error("Failed to read session:", { sessionId: id, error });
    return null;
  } finally {
    releaseLock(id);
  }
}

export function deleteSession(id: string): void {
  if (IS_VERCEL) return;

  waitForLock(id);

  try {
    const lockFile = getLockFile(id);
    fs.writeFileSync(lockFile, "", "utf8");

    const filePath = path.join(SESSIONS_DIR, `${id}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    log.error("Failed to delete session:", { sessionId: id, error });
  } finally {
    releaseLock(id);
  }
}

export function listPersistedSessions(): PersistedSession[] {
  if (IS_VERCEL) return [];

  ensureDir();

  try {
    return fs
      .readdirSync(SESSIONS_DIR)
      .filter((name) => name.endsWith(".json"))
      .flatMap((name) => {
        try {
          const filePath = path.join(SESSIONS_DIR, name);
          const session = parsePersistedSession(fs.readFileSync(filePath, "utf8"));
          return session ? [session] : [];
        } catch (error) {
          log.debug("Skipping invalid persisted browser session:", { fileName: name, error });
          return [];
        }
      })
      .sort((left, right) => right.createdAt - left.createdAt);
  } catch (error) {
    log.error("Failed to list persisted browser sessions:", error);
    return [];
  }
}
