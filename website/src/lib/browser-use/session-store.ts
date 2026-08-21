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
import { normalizeOpenableBrowserUrl } from "@/lib/browser-use/openable-url";
import { normalizeScreenshotDataUrl } from "@/lib/chat/screenshot-data-url";
import { createServerLogger } from "@/lib/server-logger";
import { normalizeWebSocketDebuggerUrl } from "./connection";

const log = createServerLogger("BrowserSessionStore");

const SESSIONS_DIR = path.join(os.tmpdir(), "rearvy-browser-sessions");
const IS_VERCEL = Boolean(process.env.VERCEL);
const LOCK_WAIT_MS = 100;
const MAX_LOCK_WAIT_ATTEMPTS = 10;
const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;
const CONTROL_CHAR_PATTERN = /[\x00-\x1f\x7f]/g;
const MAX_TEXT_FIELD_LENGTH = 2000;
const MAX_ID_FIELD_LENGTH = 256;
const MAX_OUTPUT_LINE_LENGTH = 4000;
const MAX_STDOUT_LINES = 500;
const MAX_STDERR_LINES = 200;
const MAX_ACTION_LOG_ENTRIES = 120;

function ensureDir() {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

export function normalizeBrowserSessionId(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const id = value.trim();
  return SESSION_ID_PATTERN.test(id) ? id : null;
}

function getSessionFilePath(id: string, extension: "json" | "lock"): string | null {
  const normalizedId = normalizeBrowserSessionId(id);
  if (!normalizedId) {
    return null;
  }

  const sessionsRoot = path.resolve(SESSIONS_DIR);
  const filePath = path.resolve(sessionsRoot, `${normalizedId}.${extension}`);
  const relativePath = path.relative(sessionsRoot, filePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }

  return filePath;
}

function getLockFile(id: string): string | null {
  return getSessionFilePath(id, "lock");
}

function waitForLock(id: string, attempts = 0): boolean {
  const lockFile = getLockFile(id);
  if (!lockFile) {
    return false;
  }

  if (fs.existsSync(lockFile) && attempts < MAX_LOCK_WAIT_ATTEMPTS) {
    // Sleep briefly then retry
    const now = Date.now();
    while (Date.now() - now < LOCK_WAIT_MS) {
      // Busy wait (intentional for cross-process synchronization)
    }
    return waitForLock(id, attempts + 1);
  }

  return true;
}

function releaseLock(id: string): void {
  try {
    const lockFile = getLockFile(id);
    if (lockFile && fs.existsSync(lockFile)) {
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
  connectionMethod?: "cdp-direct" | "extension-relay" | "managed-runner" | "firecrawl";
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
  liveViewUrl?: string | null;
  interactiveLiveViewUrl?: string | null;
};

function normalizeText(value: unknown, maxLength = MAX_TEXT_FIELD_LENGTH): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const cleaned = value.replace(CONTROL_CHAR_PATTERN, " ").trim();
  if (!cleaned) {
    return undefined;
  }

  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

function optionalString(value: unknown): string | undefined {
  return normalizeText(value);
}

function optionalStringOrNull(value: unknown): string | null | undefined {
  return value === null || value === undefined
    ? value
    : normalizeText(value);
}

function optionalScreenshotDataUrl(value: unknown): string | null | undefined {
  if (value === null || value === undefined) {
    return value;
  }

  return normalizeScreenshotDataUrl(value);
}

function optionalOpenableBrowserUrl(value: unknown): string | null | undefined {
  if (value === null || value === undefined) {
    return value;
  }

  return normalizeOpenableBrowserUrl(value);
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

function optionalStringArray(
  value: unknown,
  maxItems: number,
  maxLength = MAX_OUTPUT_LINE_LENGTH
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(-maxItems)
    .flatMap((item) => {
      const text = normalizeText(item, maxLength);
      return text ? [text] : [];
    });
}

function normalizeConnectedBrowser(value: unknown): PersistedSession["connectedBrowser"] {
  if (value === null || value === undefined) return value;
  if (!isRecord(value)) return undefined;
  return {
    name: optionalStringOrNull(value.name),
    version: optionalStringOrNull(value.version),
    webSocketDebuggerUrl:
      value.webSocketDebuggerUrl === null || value.webSocketDebuggerUrl === undefined
        ? value.webSocketDebuggerUrl
        : normalizeWebSocketDebuggerUrl(value.webSocketDebuggerUrl),
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
    .slice(-MAX_ACTION_LOG_ENTRIES)
    .filter(isRecord)
    .map((entry) => ({
      id: normalizeText(entry.id, MAX_ID_FIELD_LENGTH) || "",
      action: normalizeText(entry.action, MAX_ID_FIELD_LENGTH) || "event",
      status: normalizeText(entry.status, MAX_ID_FIELD_LENGTH) || "running",
      message: normalizeText(entry.message, MAX_OUTPUT_LINE_LENGTH) || "",
      timestamp: normalizeText(entry.timestamp, MAX_ID_FIELD_LENGTH) || new Date().toISOString(),
    }))
    .filter((entry) => entry.id);
}

export function parsePersistedSession(raw: string): PersistedSession | null {
  const parsed = parseJsonRecord(raw);
  if (!parsed) return null;

  const id = normalizeBrowserSessionId(parsed.id);
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
    stdout: optionalStringArray(parsed.stdout, MAX_STDOUT_LINES),
    stderr: optionalStringArray(parsed.stderr, MAX_STDERR_LINES),
    isRunning: parsed.isRunning === true,
    pid: optionalNumber(parsed.pid),
    status: optionalString(parsed.status),
    currentUrl: optionalOpenableBrowserUrl(parsed.currentUrl),
    title: optionalStringOrNull(parsed.title),
    summary: optionalStringOrNull(parsed.summary),
    screenshotDataUrl: optionalScreenshotDataUrl(parsed.screenshotDataUrl),
    setupError: optionalStringOrNull(parsed.setupError),
    awaitingApproval: normalizeAwaitingApproval(parsed.awaitingApproval),
    actionLog: normalizeActionLog(parsed.actionLog),
    exitCode: optionalNumberOrNull(parsed.exitCode),
    exitedAt: optionalNumberOrNull(parsed.exitedAt),
    liveViewUrl: optionalStringOrNull(parsed.liveViewUrl),
    interactiveLiveViewUrl: optionalStringOrNull(parsed.interactiveLiveViewUrl),
  };
}

export function writeSession(data: PersistedSession): void {
  // Avoid writing files in serverless/edge environments (e.g. Vercel)
  if (IS_VERCEL) return;

  ensureDir();
  const id = normalizeBrowserSessionId(data.id);
  if (!id || !waitForLock(id)) {
    log.error("Refusing to write browser session with invalid id:", { sessionId: data.id });
    return;
  }

  try {
    const lockFile = getLockFile(id);
    const filePath = getSessionFilePath(id, "json");
    if (!lockFile || !filePath) {
      throw new Error("Invalid browser session path");
    }

    fs.writeFileSync(lockFile, "", "utf8");

    // Write to temp file first, then atomically rename
    const tempPath = `${filePath}.tmp`;

    fs.writeFileSync(tempPath, JSON.stringify({ ...data, id }), "utf8");
    fs.renameSync(tempPath, filePath); // Atomic rename
  } catch (error) {
    log.error("Failed to write session:", { sessionId: id, error });
    // Non-fatal - in-memory store is still the source of truth.
  } finally {
    releaseLock(id);
  }
}

export function readSession(id: string): PersistedSession | null {
  if (IS_VERCEL) return null;

  const normalizedId = normalizeBrowserSessionId(id);
  if (!normalizedId || !waitForLock(normalizedId)) {
    return null;
  }

  try {
    const lockFile = getLockFile(normalizedId);
    const filePath = getSessionFilePath(normalizedId, "json");
    if (!lockFile || !filePath) {
      return null;
    }

    fs.writeFileSync(lockFile, "", "utf8");

    if (!fs.existsSync(filePath)) return null;

    const session = parsePersistedSession(fs.readFileSync(filePath, "utf8"));
    return session?.id === normalizedId ? session : null;
  } catch (error) {
    log.error("Failed to read session:", { sessionId: normalizedId, error });
    return null;
  } finally {
    releaseLock(normalizedId);
  }
}

export function deleteSession(id: string): void {
  if (IS_VERCEL) return;

  const normalizedId = normalizeBrowserSessionId(id);
  if (!normalizedId || !waitForLock(normalizedId)) {
    return;
  }

  try {
    const lockFile = getLockFile(normalizedId);
    const filePath = getSessionFilePath(normalizedId, "json");
    if (!lockFile || !filePath) {
      return;
    }

    fs.writeFileSync(lockFile, "", "utf8");

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    log.error("Failed to delete session:", { sessionId: normalizedId, error });
  } finally {
    releaseLock(normalizedId);
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
