/**
 * Browser Session Manager
 *
 * Runs the local Python browser-use runner as a child process and keeps a
 * small in-memory/session-store view for API polling and Turbopack route
 * isolation.
 */

import type { ChildProcess } from "child_process";
import { randomUUID } from "crypto";
import fs from "fs";
import { createRequire } from "module";
import path from "path";
import {
  chooseBrowserConnectionMethod,
  getBrowserConnectionStatus,
  getBrowserRelayPort,
  getCdpPort,
  type BrowserConnectionMethod,
} from "./connection";
import type { PersistedSession } from "./session-store";

type BrowserActionLogEntry = NonNullable<PersistedSession["actionLog"]>[number];

type BrowserRunnerEvent = {
  ok?: boolean;
  type?: string;
  status?: string;
  id?: string;
  message?: string;
  error?: string;
  setupError?: string | null;
  currentUrl?: string | null;
  title?: string | null;
  summary?: string | null;
  awaitingApproval?: PersistedSession["awaitingApproval"];
  connectionMethod?: PersistedSession["connectionMethod"];
  connectedBrowser?: PersistedSession["connectedBrowser"];
  action?: string;
  timestamp?: string;
};

export type BrowserSession = {
  id: string;
  task: string;
  createdAt: number;
  userId?: string;
  child?: ChildProcess;
  connectionMethod: BrowserConnectionMethod;
  connectionStatus: string | null;
  connectedBrowser: PersistedSession["connectedBrowser"];
  extensionRelay: PersistedSession["extensionRelay"];
  stdout: string[];
  stderr: string[];
  status: string;
  currentUrl: string | null;
  title: string | null;
  summary: string | null;
  setupError: string | null;
  awaitingApproval: PersistedSession["awaitingApproval"];
  actionLog: BrowserActionLogEntry[];
  exitCode: number | null;
  exitedAt: number | null;
};

type CreateSessionOptions = {
  connectionMethod?: BrowserConnectionMethod | "auto";
};

const sessions: Map<string, BrowserSession> =
  (globalThis as { __browserSessions?: Map<string, BrowserSession> }).__browserSessions ??
  ((globalThis as { __browserSessions?: Map<string, BrowserSession> }).__browserSessions =
    new Map());

const IS_VERCEL = Boolean(process.env.VERCEL);
const MAX_STDOUT_LINES = 500;
const MAX_STDERR_LINES = 200;
const MAX_ACTION_LOG = 120;

function createError(message: string): { ok: false; error: string } {
  return { ok: false, error: message };
}

function findRepoRoot(startDir = process.cwd()): string {
  let current = path.resolve(startDir);

  for (let depth = 0; depth < 8; depth += 1) {
    if (fs.existsSync(path.join(current, "scripts", "browser-use"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return path.resolve(startDir, "..");
}

function resolveScriptPath(repoRoot: string): string {
  return (
    process.env.BROWSER_USE_SCRIPT_PATH ||
    path.join(repoRoot, "scripts", "browser-use", "runner.py")
  );
}

function resolveProjectDir(repoRoot: string): string {
  return process.env.BROWSER_USE_PROJECT_DIR || path.join(repoRoot, "scripts", "browser-use");
}

function resolveRunnerInvocation(
  repoRoot: string,
  scriptPath: string,
  id: string,
  task: string,
  options: {
    connectionMethod: BrowserConnectionMethod;
    cdpUrl?: string | null;
  }
): {
  cmd: string;
  args: string[];
} {
  const timeoutMs = process.env.BROWSER_USE_TIMEOUT_MS || "60000";
  const useUv = process.env.BROWSER_USE_USE_UV !== "false";
  const connectionArgs = [
    "--connection-method",
    options.connectionMethod,
    ...(options.cdpUrl ? ["--cdp-url", options.cdpUrl] : []),
  ];

  if (useUv) {
    return {
      cmd: process.env.UV_PATH || "uv",
      args: [
        "run",
        "--project",
        resolveProjectDir(repoRoot),
        "python",
        scriptPath,
        "--task",
        task,
        "--id",
        id,
        "--keep-open",
        "--timeout-ms",
        timeoutMs,
        ...connectionArgs,
      ],
    };
  }

  const python = process.env.PYTHON_PATH || (process.platform === "win32" ? "python" : "python3");
  return {
    cmd: python,
    args: [
      scriptPath,
      "--task",
      task,
      "--id",
      id,
      "--keep-open",
      "--timeout-ms",
      timeoutMs,
      ...connectionArgs,
    ],
  };
}

function probeCommand(cmd: string): string | null {
  const require = createRequire(import.meta.url);
  const { spawnSync } = require("child_process") as typeof import("child_process");
  const result = spawnSync(cmd, ["--version"], {
    stdio: "ignore",
    windowsHide: true,
  });

  if (result.error) {
    return result.error.message;
  }

  if (typeof result.status === "number" && result.status !== 0) {
    return `${cmd} --version exited with code ${result.status}`;
  }

  return null;
}

function envFileHasAnyKey(filePath: string, names: string[]): boolean {
  try {
    if (!fs.existsSync(filePath)) {
      return false;
    }

    const content = fs.readFileSync(filePath, "utf8");
    return names.some((name) => new RegExp(`^\\s*${name}\\s*=\\s*.+`, "m").test(content));
  } catch {
    return false;
  }
}

function hasLocalLlmConfiguration(repoRoot: string): boolean {
  const names = [
    "OPENROUTER_API_KEY",
    "OPENAI_API_KEY",
    "GOOGLE_API_KEY",
    "GEMINI_API_KEY",
    "NVIDIA_API_KEY",
  ];

  if (names.some((name) => Boolean(process.env[name]))) {
    return true;
  }

  return [
    path.join(repoRoot, ".env.local"),
    path.join(repoRoot, "website", ".env.local"),
    path.join(repoRoot, "desktop-app", ".env.local"),
  ].some((filePath) => envFileHasAnyKey(filePath, names));
}

function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s)]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s)]*)?/i);
  if (!match) {
    return null;
  }

  const value = match[0].replace(/[.,;]+$/, "");
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function relayBaseUrl() {
  return `http://127.0.0.1:${getBrowserRelayPort()}`;
}

async function postRelayCommand(input: Record<string, unknown>) {
  const response = await fetch(`${relayBaseUrl()}/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; command?: { id?: string }; error?: string }
    | null;

  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `Browser relay returned HTTP ${response.status}`);
  }

  return payload?.command ?? null;
}

function commandToRelayAction(command: string): Record<string, unknown> {
  const url = extractUrl(command);
  if (url && /\b(open|visit|go to|goto|navigate|load)\b/i.test(command)) {
    return { type: "navigate", url };
  }

  if (/\b(extract|summarize|read|inspect|get text)\b/i.test(command)) {
    return { type: "extract" };
  }

  return { type: "extract" };
}

function trimPush(lines: string[], line: string, max: number) {
  if (!line) {
    return;
  }

  lines.push(line);
  if (lines.length > max) {
    lines.splice(0, lines.length - max);
  }
}

function formatEventLine(event: BrowserRunnerEvent): string {
  const status = event.status || event.type || "event";
  const message = event.message || event.error || event.summary || "";
  return message ? `[${status}] ${message}` : `[${status}]`;
}

function parseRunnerEvent(line: string): BrowserRunnerEvent | null {
  try {
    const parsed = JSON.parse(line) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as BrowserRunnerEvent;
  } catch {
    return null;
  }
}

function applyRunnerEvent(session: BrowserSession, event: BrowserRunnerEvent) {
  if (event.status) {
    session.status = event.status;
  }

  if (typeof event.currentUrl === "string") {
    session.currentUrl = event.currentUrl;
  }

  if (typeof event.title === "string") {
    session.title = event.title;
  }

  if (typeof event.summary === "string") {
    session.summary = event.summary;
  }

  if (typeof event.setupError === "string" && event.setupError.trim()) {
    session.setupError = event.setupError;
  } else if (event.status === "setup_error" && typeof event.error === "string") {
    session.setupError = event.error;
  }

  if (Object.prototype.hasOwnProperty.call(event, "awaitingApproval")) {
    session.awaitingApproval = event.awaitingApproval ?? null;
  }

  if (event.connectionMethod) {
    session.connectionMethod = event.connectionMethod;
  }

  if (event.connectedBrowser) {
    session.connectedBrowser = event.connectedBrowser;
  }

  if (event.action || event.message || event.error) {
    session.actionLog.push({
      id: `${event.action || event.status || "event"}_${Date.now()}_${session.actionLog.length}`,
      action: event.action || event.type || event.status || "event",
      status: event.status || (event.ok === false ? "failed" : "running"),
      message: event.message || event.error || event.summary || "Browser event",
      timestamp: event.timestamp || new Date().toISOString(),
    });

    if (session.actionLog.length > MAX_ACTION_LOG) {
      session.actionLog = session.actionLog.slice(-MAX_ACTION_LOG);
    }
  }
}

export function serializeSession(session: BrowserSession): PersistedSession {
  return {
    id: session.id,
    task: session.task,
    createdAt: session.createdAt,
    userId: session.userId,
    connectionMethod: session.connectionMethod,
    connectionStatus: session.connectionStatus,
    connectedBrowser: session.connectedBrowser,
    extensionRelay: session.extensionRelay,
    stdout: session.stdout,
    stderr: session.stderr,
    isRunning: session.exitCode === null && !session.child?.killed,
    pid: session.child?.pid,
    status: session.status,
    currentUrl: session.currentUrl,
    title: session.title,
    summary: session.summary,
    setupError: session.setupError,
    awaitingApproval: session.awaitingApproval,
    actionLog: session.actionLog,
    exitCode: session.exitCode,
    exitedAt: session.exitedAt,
  };
}

function syncSession(session: BrowserSession) {
  if (IS_VERCEL) return;

  try {
    const require = createRequire(import.meta.url);
    const { writeSession } = require("./session-store") as typeof import("./session-store");
    writeSession(serializeSession(session));
  } catch {
    // The in-memory session remains the source of truth.
  }
}

export async function createSession(
  task: string,
  userId?: string,
  options: CreateSessionOptions = {}
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (IS_VERCEL) {
    return createError("Browser sessions are only available in the local Rearvy desktop/dev runtime, not Vercel serverless.");
  }

  const requestedMethod = options.connectionMethod || "auto";
  const connectionStatus =
    requestedMethod === "managed-runner"
      ? null
      : await getBrowserConnectionStatus().catch(() => null);
  const connectionMethod =
    requestedMethod === "auto"
      ? chooseBrowserConnectionMethod({
          cdpDirect: connectionStatus?.cdpDirect,
          extensionRelay: connectionStatus?.extensionRelay,
          allowedMethods: ["cdp-direct", "extension-relay", "managed-runner"],
        })
      : requestedMethod;

  if (connectionMethod === "extension-relay") {
    try {
      const id = randomUUID();
      const url = extractUrl(task);
      const relayCommand = url
        ? { type: "navigate", url }
        : commandToRelayAction(task);
      const command = await postRelayCommand(relayCommand);
      const session: BrowserSession = {
        id,
        task,
        createdAt: Date.now(),
        userId,
        connectionMethod,
        connectionStatus: "connected",
        connectedBrowser: null,
        extensionRelay: {
          port: getBrowserRelayPort(),
          commandId: typeof command?.id === "string" ? command.id : null,
          extensionId: connectionStatus?.extensionRelay.extensionId || null,
        },
        stdout: ["Starting browser extension relay session..."],
        stderr: [],
        status: "running",
        currentUrl: url,
        title: null,
        summary: url
          ? `Sent navigation command to the browser extension relay for ${url}.`
          : "Sent command to the browser extension relay.",
        setupError: null,
        awaitingApproval: null,
        actionLog: [
          {
            id: `extension_relay_${Date.now()}`,
            action: "extension_relay",
            status: "running",
            message: url
              ? `Navigating connected Chrome to ${url}.`
              : "Running extension relay command.",
            timestamp: new Date().toISOString(),
          },
        ],
        exitCode: null,
        exitedAt: null,
      };
      sessions.set(id, session);
      syncSession(session);
      return { ok: true, id };
    } catch (err) {
      return createError(err instanceof Error ? err.message : String(err));
    }
  }

  const repoRoot = findRepoRoot();
  const scriptPath = resolveScriptPath(repoRoot);
  const projectDir = resolveProjectDir(repoRoot);

  if (!fs.existsSync(scriptPath)) {
    return createError(`Browser runner is missing at ${scriptPath}. Restore scripts/browser-use/runner.py.`);
  }

  if (!fs.existsSync(path.join(projectDir, "pyproject.toml"))) {
    return createError(`Browser runner project is missing at ${path.join(projectDir, "pyproject.toml")}.`);
  }

  if (!hasLocalLlmConfiguration(repoRoot)) {
    return createError(
      "Browser automation needs OPENROUTER_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY, GEMINI_API_KEY, or NVIDIA_API_KEY in .env.local."
    );
  }

  try {
    const id = randomUUID();
    const cdpUrl =
      connectionMethod === "cdp-direct"
        ? `http://127.0.0.1:${getCdpPort()}`
        : null;
    const { cmd, args } = resolveRunnerInvocation(repoRoot, scriptPath, id, task, {
      connectionMethod,
      cdpUrl,
    });
    const probeError = probeCommand(cmd);
    if (probeError) {
      const installHint =
        cmd === "uv"
          ? "Install uv, or set BROWSER_USE_USE_UV=false and PYTHON_PATH to a Python with browser-use installed."
          : `Set PYTHON_PATH to a valid Python executable. ${cmd} failed.`;
      return createError(`${cmd} is not available for browser automation. ${installHint} Detail: ${probeError}`);
    }

    const require = createRequire(import.meta.url);
    const { spawn } = require("child_process") as typeof import("child_process");
    const child = spawn(cmd, args, {
      cwd: repoRoot,
      env: {
        ...process.env,
        BROWSER_USE_TASK: task,
        BROWSER_USE_SESSION_ID: id,
        BROWSER_USE_CONNECTION_METHOD: connectionMethod,
        ...(cdpUrl ? { BROWSER_USE_CDP_URL: cdpUrl } : {}),
      },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    const session: BrowserSession = {
      id,
      task,
      createdAt: Date.now(),
      userId,
      child,
      connectionMethod,
      connectionStatus:
        connectionMethod === "cdp-direct" && connectionStatus?.cdpDirect.connected
          ? "connected"
          : connectionMethod === "managed-runner"
            ? "managed"
            : null,
      connectedBrowser:
        connectionMethod === "cdp-direct"
          ? {
              name: connectionStatus?.cdpDirect.browser || null,
              version: connectionStatus?.cdpDirect.browser || null,
              webSocketDebuggerUrl:
                connectionStatus?.cdpDirect.webSocketDebuggerUrl || null,
            }
          : null,
      extensionRelay: null,
      stdout: ["Starting local browser-use session..."],
      stderr: [],
      status: "initializing",
      currentUrl: null,
      title: null,
      summary: null,
      setupError: null,
      awaitingApproval: null,
      actionLog: [],
      exitCode: null,
      exitedAt: null,
    };

    child.stdout?.on("data", (data: Buffer) => {
      for (const rawLine of data.toString().split(/\r?\n/).filter(Boolean)) {
        const line = rawLine.trim();
        const event = parseRunnerEvent(line);
        if (event) {
          applyRunnerEvent(session, event);
          trimPush(session.stdout, formatEventLine(event), MAX_STDOUT_LINES);
        } else {
          trimPush(session.stdout, line, MAX_STDOUT_LINES);
        }
      }
      syncSession(session);
    });

    child.stderr?.on("data", (data: Buffer) => {
      for (const rawLine of data.toString().split(/\r?\n/).filter(Boolean)) {
        trimPush(session.stderr, rawLine.trim(), MAX_STDERR_LINES);
      }
      syncSession(session);
    });

    child.on("error", (error: Error) => {
      session.status = "setup_error";
      session.setupError = error.message;
      trimPush(session.stderr, `Process error: ${error.message}`, MAX_STDERR_LINES);
      syncSession(session);
    });

    child.on("exit", (code: number | null) => {
      session.exitCode = code;
      session.exitedAt = Date.now();
      if (!["closed", "completed", "rejected", "failed", "setup_error", "timeout"].includes(session.status)) {
        session.status = code === 0 ? "closed" : "failed";
      }
      trimPush(session.stdout, `__EXIT_CODE__${code ?? "null"}`, MAX_STDOUT_LINES);
      syncSession(session);
    });

    sessions.set(id, session);
    syncSession(session);
    return { ok: true, id };
  } catch (err) {
    return createError(err instanceof Error ? err.message : String(err));
  }
}

export function getSession(id: string): BrowserSession | undefined {
  return sessions.get(id);
}

export async function sendCommandToSession(
  id: string,
  command: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = sessions.get(id);
  if (!session) {
    return { ok: false, error: `Session ${id} not found.` };
  }

  if (session.connectionMethod === "extension-relay") {
    try {
      const relayCommand = commandToRelayAction(command);
      const nextCommand = await postRelayCommand(relayCommand);
      session.status = "processing_command";
      session.extensionRelay = {
        ...(session.extensionRelay || {}),
        commandId: typeof nextCommand?.id === "string" ? nextCommand.id : null,
      };
      session.actionLog.push({
        id: `extension_relay_${Date.now()}_${session.actionLog.length}`,
        action: "extension_relay",
        status: "running",
        message: `Sent command to connected Chrome: ${command}`,
        timestamp: new Date().toISOString(),
      });
      syncSession(session);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  if (session.exitCode !== null || session.child?.killed || !session.child?.stdin) {
    return { ok: false, error: `Session ${id} is no longer running.` };
  }

  try {
    const normalized = command.trim();
    if (normalized) {
      session.status = normalized.toLowerCase().startsWith("approve:")
        ? "approving"
        : normalized.toLowerCase() === "approve"
          ? "approving"
          : "processing_command";
      syncSession(session);
    }
    session.child.stdin.write(`${command}\n`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function closeSession(id: string): { ok: true } | { ok: false; error: string } {
  const session = sessions.get(id);
  if (!session) {
    return { ok: false, error: `Session ${id} not found.` };
  }

  try {
    session.status = "closed";
    session.awaitingApproval = null;
    syncSession(session);

    if (session.exitCode === null && session.child && !session.child.killed) {
      session.child.stdin?.write("stop\n");
      session.child.kill("SIGTERM");
    }

    sessions.delete(id);
    if (!IS_VERCEL) {
      try {
        const require = createRequire(import.meta.url);
        const { deleteSession } = require("./session-store") as typeof import("./session-store");
        deleteSession(id);
      } catch {
        // Ignore cleanup failures.
      }
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function listSessions(): BrowserSession[] {
  return Array.from(sessions.values());
}
