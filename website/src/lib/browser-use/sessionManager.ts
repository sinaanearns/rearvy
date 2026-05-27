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
import {
  buildGoalSeekingNotFoundSummary,
  detectBrowserGoal,
  isGoalLikelySatisfied,
  rankGoalCandidates,
  type BrowserTaskStrategy,
  type PageScanResult,
  type RankedGoalCandidate,
} from "./goal-seeking";
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
  dedupeKey: string | null;
  strategy: BrowserTaskStrategy;
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
  strategy?: BrowserTaskStrategy;
  dedupeKey?: string | null;
};

type CreateSessionSuccess = {
  ok: true;
  id: string;
  reused?: boolean;
  status?: string;
  summary?: string | null;
  connectionMethod?: BrowserConnectionMethod;
};

type RelayCommand = {
  id?: string;
  status?: string;
  result?: unknown;
  error?: string | null;
};

const sessions: Map<string, BrowserSession> =
  (globalThis as { __browserSessions?: Map<string, BrowserSession> }).__browserSessions ??
  ((globalThis as { __browserSessions?: Map<string, BrowserSession> }).__browserSessions =
    new Map());

const IS_VERCEL = Boolean(process.env.VERCEL);
const MAX_STDOUT_LINES = 500;
const MAX_STDERR_LINES = 200;
const MAX_ACTION_LOG = 120;
const RELAY_COMMAND_TIMEOUT_MS = 10000;
const RELAY_COMMAND_POLL_MS = 250;

type ReusableSessionCandidate = Pick<
  PersistedSession,
  "id" | "dedupeKey" | "status" | "isRunning" | "exitCode" | "summary" | "connectionMethod"
>;

const REUSABLE_FINISHED_STATUSES = new Set(["completed"]);
const NON_REUSABLE_STATUSES = new Set([
  "closed",
  "failed",
  "setup_error",
  "timeout",
  "rejected",
]);

function createError(message: string): { ok: false; error: string } {
  return { ok: false, error: message };
}

export function findReusableBrowserSession(
  dedupeKey: string | null | undefined,
  candidates: ReusableSessionCandidate[]
): ReusableSessionCandidate | null {
  if (!dedupeKey) {
    return null;
  }

  return (
    candidates.find((candidate) => {
      if (candidate.dedupeKey !== dedupeKey) {
        return false;
      }

      const status = candidate.status || "";
      if (NON_REUSABLE_STATUSES.has(status)) {
        return false;
      }

      return candidate.isRunning || REUSABLE_FINISHED_STATUSES.has(status);
    }) ?? null
  );
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
    strategy: BrowserTaskStrategy;
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
        "--strategy",
        options.strategy,
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
      "--strategy",
      options.strategy,
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

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

export async function waitForRelayCommand(
  commandId: string,
  options: {
    timeoutMs?: number;
    pollMs?: number;
    fetchImpl?: typeof fetch;
    baseUrl?: string;
  } = {}
): Promise<RelayCommand> {
  const timeoutMs = options.timeoutMs ?? RELAY_COMMAND_TIMEOUT_MS;
  const pollMs = options.pollMs ?? RELAY_COMMAND_POLL_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl ?? relayBaseUrl();
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const response = await fetchImpl(`${baseUrl}/commands/${encodeURIComponent(commandId)}`, {
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; command?: RelayCommand; error?: string }
      | null;

    if (!response.ok || payload?.ok === false) {
      throw new Error(payload?.error || `Browser relay returned HTTP ${response.status}`);
    }

    const command = payload?.command;
    if (command?.status === "completed") {
      return command;
    }

    if (command?.status === "failed") {
      throw new Error(command.error || "Browser relay command failed.");
    }

    await delay(pollMs);
  }

  throw new Error(`Browser relay command ${commandId} timed out.`);
}

async function runRelayCommand(
  input: Record<string, unknown>,
  timeoutMs = RELAY_COMMAND_TIMEOUT_MS
) {
  const command = await postRelayCommand(input);
  const commandId = typeof command?.id === "string" ? command.id : null;
  if (!commandId) {
    return command as RelayCommand | null;
  }

  return waitForRelayCommand(commandId, { timeoutMs });
}

function commandToRelayAction(command: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(command) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Plain text command, continue with lightweight intent parsing.
  }

  const url = extractUrl(command);
  if (url && /\b(open|visit|go to|goto|navigate|load)\b/i.test(command)) {
    return { type: "navigate", url };
  }

  const scrollMatch = command.match(/\bscroll\s+(up|down|left|right|bottom|top)\b/i);
  if (scrollMatch?.[1]) {
    return { type: "scroll", direction: scrollMatch[1].toLowerCase(), amount: 720 };
  }

  if (/\b(screenshot|screen shot|capture visible|capture page)\b/i.test(command)) {
    return { type: "captureVisible" };
  }

  const clickTextMatch = command.match(/\bclick\s+["']?([^"']{2,80})["']?$/i);
  if (clickTextMatch?.[1]) {
    return { type: "clickText", target: clickTextMatch[1].trim() };
  }

  if (/\b(scan|extract|summarize|read|inspect|get text|full page)\b/i.test(command)) {
    return { type: "scanPage" };
  }

  return { type: "scanPage" };
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
    dedupeKey: session.dedupeKey,
    strategy: session.strategy,
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

function loadPersistedSessions(): PersistedSession[] {
  if (IS_VERCEL) {
    return [];
  }

  try {
    const require = createRequire(import.meta.url);
    const { listPersistedSessions } = require("./session-store") as typeof import("./session-store");
    return listPersistedSessions();
  } catch {
    return [];
  }
}

function activeSessionCandidates() {
  return Array.from(sessions.values()).map((session): ReusableSessionCandidate => ({
    id: session.id,
    dedupeKey: session.dedupeKey,
    status: session.status,
    isRunning: session.exitCode === null && !session.child?.killed,
    exitCode: session.exitCode,
    summary: session.summary,
    connectionMethod: session.connectionMethod,
  }));
}

function findReusableSession(dedupeKey: string | null | undefined) {
  const active = activeSessionCandidates();
  const persisted = loadPersistedSessions();
  return findReusableBrowserSession(dedupeKey, [...active, ...persisted]);
}

function pushAction(
  session: BrowserSession,
  action: string,
  status: string,
  message: string
) {
  session.actionLog.push({
    id: `${action}_${Date.now()}_${session.actionLog.length}`,
    action,
    status,
    message,
    timestamp: new Date().toISOString(),
  });

  if (session.actionLog.length > MAX_ACTION_LOG) {
    session.actionLog = session.actionLog.slice(-MAX_ACTION_LOG);
  }

  trimPush(session.stdout, `[${status}] ${message}`, MAX_STDOUT_LINES);
  syncSession(session);
}

function asPageScanResult(value: unknown): PageScanResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as PageScanResult;
}

function applyPageScan(session: BrowserSession, scan: PageScanResult | null) {
  if (!scan) {
    return;
  }

  if (typeof scan.url === "string") {
    session.currentUrl = scan.url;
  }

  if (typeof scan.title === "string") {
    session.title = scan.title;
  }
}

async function scanRelayPage(session: BrowserSession, attempts: string[]) {
  attempts.push("full-page scan");
  pushAction(session, "scan_page", "running", "Scanning the full page.");
  const command = await runRelayCommand({ type: "scanPage" }, 12000);
  const scan = asPageScanResult(command?.result);
  applyPageScan(session, scan);
  pushAction(
    session,
    "scan_page",
    scan ? "completed" : "failed",
    scan?.title ? `Scanned ${scan.title}.` : "Scanned page content."
  );
  return scan;
}

function candidateTarget(candidate: RankedGoalCandidate) {
  return candidate.text || candidate.href || candidate.selector || candidate.kind;
}

async function followRelayCandidate(
  session: BrowserSession,
  candidate: RankedGoalCandidate,
  attempts: string[]
) {
  const label = candidateTarget(candidate);
  attempts.push(`candidate: ${label}`);
  pushAction(session, "candidate", "running", `Trying ${label}.`);

  if (candidate.href) {
    const command = await runRelayCommand({ type: "navigate", url: candidate.href }, 12000);
    if (command?.status === "completed") {
      await delay(900);
      return true;
    }
  }

  if (candidate.selector) {
    const command = await runRelayCommand(
      { type: "click", target: candidate.selector },
      12000
    );
    if (command?.status === "completed") {
      await delay(900);
      return true;
    }
  }

  if (candidate.text) {
    const command = await runRelayCommand(
      { type: "clickText", target: candidate.text },
      12000
    );
    if (command?.status === "completed") {
      await delay(900);
      return true;
    }
  }

  return false;
}

function likelyGoalRoutes(currentUrl: string | null, task: string) {
  if (!currentUrl) {
    return [];
  }

  try {
    const origin = new URL(currentUrl).origin;
    const goal = detectBrowserGoal(task);
    const paths =
      goal === "login"
        ? ["/login", "/sign-in", "/signin", "/account/login", "/admin"]
        : goal === "signup"
          ? ["/signup", "/sign-up", "/register", "/start", "/start-free-trial", "/trial"]
          : ["/"];

    return paths.map((pathname) => `${origin}${pathname}`);
  } catch {
    return [];
  }
}

async function runExtensionRelayOpenOnly(
  session: BrowserSession,
  task: string,
  url: string | null
) {
  if (url) {
    pushAction(session, "navigate", "running", `Opening ${url}.`);
    await runRelayCommand({ type: "navigate", url }, 12000);
    await delay(900);
  }

  const scan = await scanRelayPage(session, ["page scan"]);
  session.status = "completed";
  session.summary = scan?.title
    ? `Opened ${scan.title} at ${scan.url || url || "the browser page"}.`
    : `Opened ${url || "the requested browser page"}.`;
  syncSession(session);
}

async function runExtensionRelayGoalSeeking(
  session: BrowserSession,
  task: string,
  url: string | null
) {
  const attempts: string[] = [];

  if (url) {
    attempts.push("start URL");
    pushAction(session, "navigate", "running", `Opening ${url}.`);
    await runRelayCommand({ type: "navigate", url }, 12000);
    await delay(1000);
  }

  for (let cycle = 0; cycle < 3; cycle += 1) {
    const scan = await scanRelayPage(session, attempts);
    if (scan && isGoalLikelySatisfied(scan, task)) {
      session.status = "completed";
      session.summary = `Found the requested browser target on ${scan.title || scan.url || "the page"}.`;
      syncSession(session);
      return;
    }

    const [candidate] = scan ? rankGoalCandidates(scan, task) : [];
    if (candidate && (await followRelayCandidate(session, candidate, attempts))) {
      continue;
    }

    attempts.push("scroll");
    pushAction(session, "scroll", "running", "Scrolling to inspect more of the page.");
    await runRelayCommand({ type: "scroll", direction: "down", amount: 900 }, 8000);
    await delay(700);
  }

  for (const route of likelyGoalRoutes(session.currentUrl || url, task).slice(0, 4)) {
    attempts.push(route);
    pushAction(session, "route_fallback", "running", `Trying ${route}.`);
    await runRelayCommand({ type: "navigate", url: route }, 12000);
    await delay(900);
    const scan = await scanRelayPage(session, attempts);
    if (scan && isGoalLikelySatisfied(scan, task)) {
      session.status = "completed";
      session.summary = `Found the requested browser target on ${scan.title || route}.`;
      syncSession(session);
      return;
    }
  }

  attempts.push("visible screenshot");
  pushAction(session, "screenshot", "running", "Capturing a visible screenshot for context.");
  await runRelayCommand({ type: "captureVisible" }, 12000).catch((error) => {
    pushAction(
      session,
      "screenshot",
      "failed",
      error instanceof Error ? error.message : String(error)
    );
  });

  session.status = "completed";
  session.summary = buildGoalSeekingNotFoundSummary(attempts);
  syncSession(session);
}

export async function createSession(
  task: string,
  userId?: string,
  options: CreateSessionOptions = {}
): Promise<CreateSessionSuccess | { ok: false; error: string }> {
  if (IS_VERCEL) {
    return createError("Browser sessions are only available in the local Rearvy desktop/dev runtime, not Vercel serverless.");
  }

  const dedupeKey = options.dedupeKey?.trim() || null;
  const strategy = options.strategy || "goal-seeking";
  const reusable = findReusableSession(dedupeKey);
  if (reusable) {
    return {
      ok: true,
      id: reusable.id,
      reused: true,
      status: reusable.status,
      summary: reusable.summary,
      connectionMethod: reusable.connectionMethod,
    };
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
    let extensionSession: BrowserSession | null = null;
    try {
      const id = randomUUID();
      const url = extractUrl(task);
      const session: BrowserSession = {
        id,
        task,
        createdAt: Date.now(),
        userId,
        dedupeKey,
        strategy,
        connectionMethod,
        connectionStatus: "connected",
        connectedBrowser: null,
        extensionRelay: {
          port: getBrowserRelayPort(),
          commandId: null,
          extensionId: connectionStatus?.extensionRelay.extensionId || null,
        },
        stdout: ["Starting browser extension relay session..."],
        stderr: [],
        status: "initializing",
        currentUrl: url,
        title: null,
        summary: url
          ? `Preparing connected browser for ${url}.`
          : "Preparing connected browser task.",
        setupError: null,
        awaitingApproval: null,
        actionLog: [
          {
            id: `extension_relay_${Date.now()}`,
            action: "extension_relay",
            status: "running",
            message:
              strategy === "goal-seeking"
                ? "Starting bounded page scan and navigation."
                : "Starting browser relay command.",
            timestamp: new Date().toISOString(),
          },
        ],
        exitCode: null,
        exitedAt: null,
      };
      extensionSession = session;
      sessions.set(id, session);
      syncSession(session);

      if (strategy === "open-only") {
        await runExtensionRelayOpenOnly(session, task, url);
      } else {
        await runExtensionRelayGoalSeeking(session, task, url);
      }

      return {
        ok: true,
        id,
        status: session.status,
        summary: session.summary,
        connectionMethod,
      };
    } catch (err) {
      if (extensionSession) {
        extensionSession.status = "failed";
        extensionSession.dedupeKey = null;
        extensionSession.setupError = err instanceof Error ? err.message : String(err);
        syncSession(extensionSession);
      }

      if (strategy === "goal-seeking" && requestedMethod !== "managed-runner") {
        const fallback = await createSession(task, userId, {
          ...options,
          connectionMethod: "managed-runner",
          strategy,
          dedupeKey,
        });
        if (fallback.ok) {
          return fallback;
        }

        return createError(
          `${err instanceof Error ? err.message : String(err)} Fallback browser runner also failed: ${fallback.error}`
        );
      }

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
      strategy,
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
        BROWSER_USE_STRATEGY: strategy,
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
      dedupeKey,
      strategy,
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
    return {
      ok: true,
      id,
      status: session.status,
      summary: session.summary,
      connectionMethod,
    };
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
      const nextCommand = await runRelayCommand(relayCommand);
      session.status = "processing_command";
      session.extensionRelay = {
        ...(session.extensionRelay || {}),
        commandId: typeof nextCommand?.id === "string" ? nextCommand.id : null,
      };
      session.actionLog.push({
        id: `extension_relay_${Date.now()}_${session.actionLog.length}`,
        action: "extension_relay",
        status: "running",
        message: `Sent command to connected browser: ${command}`,
        timestamp: new Date().toISOString(),
      });
      if (nextCommand?.status === "completed") {
        session.status = "completed";
        session.summary = "Connected browser command completed.";
      }
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
