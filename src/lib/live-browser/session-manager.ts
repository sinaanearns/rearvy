import "server-only";

import { randomUUID } from "crypto";
// playwright is imported dynamically in createSession to avoid bundling it in all serverless functions
import type { Browser, BrowserContext, Locator, Page, ViewportSize } from "playwright";
import type { WebSocket } from "ws";
import {
  BROWSER_WS_STREAM_PATH,
  DEFAULT_BROWSER_CAPTURE_INTERVAL_MS,
  DEFAULT_BROWSER_IDLE_TIMEOUT_MS,
  DEFAULT_BROWSER_VIEWPORT,
  type BrowserActionLogEntry,
  type BrowserCommandExecutionResult,
  type BrowserCommandInput,
  type BrowserSessionSnapshot,
  type BrowserSessionStatus,
  getConfiguredBrowserWsPort,
} from "./shared";

type ManagedBrowserSession = {
  sessionId: string;
  userId: string;
  streamToken: string;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  sockets: Set<WebSocket>;
  captureTimer: NodeJS.Timeout | null;
  idleTimer: NodeJS.Timeout | null;
  captureInFlight: boolean;
  commandQueue: Promise<unknown>;
  createdAt: string;
  updatedAt: string;
  status: BrowserSessionStatus;
  currentUrl: string | null;
  title: string | null;
  frameDataUrl: string | null;
  viewport: ViewportSize;
  actionLog: BrowserActionLogEntry[];
  lastAction: BrowserActionLogEntry | null;
  headless: boolean;
  streamPort: number;
  streamPath: string;
};

type CreateSessionInput = {
  userId: string;
  headless?: boolean;
  initialUrl?: string | null;
  viewport?: ViewportSize;
};

declare global {
  var __rearvyLiveBrowserManager:
    | LiveBrowserSessionManager
    | undefined;
}

function nowIso() {
  return new Date().toISOString();
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function toDataUrl(buffer: Buffer) {
  return `data:image/jpeg;base64,${buffer.toString("base64")}`;
}

function trimActionLog(actionLog: BrowserActionLogEntry[]) {
  return actionLog.slice(-12);
}

function normalizeUrlTarget(target: string) {
  const trimmed = target.trim();
  if (!trimmed) {
    throw new Error("A URL is required for goto actions.");
  }

  try {
    return new URL(trimmed).toString();
  } catch {
    return new URL(`https://${trimmed}`).toString();
  }
}

function looksLikeLocatorTarget(target: string) {
  return (
    target.startsWith("css=") ||
    target.startsWith("xpath=") ||
    target.startsWith("//") ||
    target.startsWith("[") ||
    target.startsWith(".") ||
    target.startsWith("#") ||
    /[>~:[\]=]/.test(target)
  );
}

async function firstVisibleLocator(
  candidates: Array<() => Locator>,
  timeoutMs = 2500
) {
  let lastLocator: Locator | null = null;

  for (const createLocator of candidates) {
    const locator = createLocator().first();
    lastLocator = locator;

    try {
      await locator.waitFor({ state: "visible", timeout: timeoutMs });
      return locator;
    } catch {
      // Try the next candidate.
    }
  }

  if (!lastLocator) {
    throw new Error("No locator candidates were provided.");
  }

  return lastLocator;
}

async function resolveClickLocator(page: Page, target: string) {
  const trimmedTarget = target.trim();
  if (!trimmedTarget) {
    throw new Error("A target is required for click actions.");
  }

  if (trimmedTarget.startsWith("css=")) {
    return page.locator(trimmedTarget.slice(4)).first();
  }

  if (trimmedTarget.startsWith("xpath=")) {
    return page.locator(trimmedTarget.slice(6)).first();
  }

  if (trimmedTarget.startsWith("text=")) {
    return page.getByText(trimmedTarget.slice(5), { exact: false }).first();
  }

  if (looksLikeLocatorTarget(trimmedTarget)) {
    return page.locator(trimmedTarget).first();
  }

  return firstVisibleLocator([
    () => page.getByRole("button", { name: trimmedTarget, exact: false }),
    () => page.getByRole("link", { name: trimmedTarget, exact: false }),
    () => page.getByText(trimmedTarget, { exact: false }),
  ]);
}

async function resolveTypeLocator(page: Page, target: string) {
  const trimmedTarget = target.trim();
  if (!trimmedTarget) {
    throw new Error("A target is required for type actions.");
  }

  if (trimmedTarget.startsWith("css=")) {
    return page.locator(trimmedTarget.slice(4)).first();
  }

  if (trimmedTarget.startsWith("xpath=")) {
    return page.locator(trimmedTarget.slice(6)).first();
  }

  if (trimmedTarget.startsWith("label=")) {
    return page.getByLabel(trimmedTarget.slice(6), { exact: false }).first();
  }

  if (trimmedTarget.startsWith("placeholder=")) {
    return page.getByPlaceholder(trimmedTarget.slice(12), { exact: false }).first();
  }

  if (looksLikeLocatorTarget(trimmedTarget)) {
    return page.locator(trimmedTarget).first();
  }

  return firstVisibleLocator([
    () => page.getByLabel(trimmedTarget, { exact: false }),
    () => page.getByPlaceholder(trimmedTarget, { exact: false }),
    () => page.getByRole("textbox", { name: trimmedTarget, exact: false }),
    () => page.getByRole("searchbox", { name: trimmedTarget, exact: false }),
    () => page.locator(`input[name="${trimmedTarget}"], textarea[name="${trimmedTarget}"]`),
  ]);
}

export class LiveBrowserSessionManager {
  private readonly sessions = new Map<string, ManagedBrowserSession>();

  async createSession(input: CreateSessionInput) {
    const sessionId = randomUUID();
    const viewport = input.viewport ?? DEFAULT_BROWSER_VIEWPORT;
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({
      headless: input.headless ?? true,
    });
    const context = await browser.newContext({
      viewport,
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();
    const session: ManagedBrowserSession = {
      sessionId,
      userId: input.userId,
      streamToken: randomUUID(),
      browser,
      context,
      page,
      sockets: new Set(),
      captureTimer: null,
      idleTimer: null,
      captureInFlight: false,
      commandQueue: Promise.resolve(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      status: "launching",
      currentUrl: null,
      title: null,
      frameDataUrl: null,
      viewport,
      actionLog: [],
      lastAction: null,
      headless: input.headless ?? true,
      streamPort: getConfiguredBrowserWsPort(),
      streamPath: BROWSER_WS_STREAM_PATH,
    };

    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) {
        session.currentUrl = page.url();
        session.updatedAt = nowIso();
        this.broadcast(session);
      }
    });

    page.on("load", () => {
      session.updatedAt = nowIso();
      void this.captureFrame(session.sessionId);
    });

    page.on("close", () => {
      if (session.status !== "closed") {
        void this.closeSession(session.sessionId);
      }
    });

    this.sessions.set(sessionId, session);
    this.startCaptureLoop(session);
    this.refreshIdleTimer(session);

    try {
      if (input.initialUrl) {
        await page.goto(input.initialUrl, { waitUntil: "domcontentloaded" });
      }
      session.status = "ready";
      session.currentUrl = page.url();
      session.title = await page.title().catch(() => null);
      await this.captureFrame(sessionId);
      this.broadcast(session);
      return this.toSnapshot(session);
    } catch (error) {
      session.status = "failed";
      session.updatedAt = nowIso();
      this.broadcast(session, {
        type: "session_error",
        error: toErrorMessage(error),
      });
      throw error;
    }
  }

  getSession(userId: string, sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) {
      return null;
    }

    return this.toSnapshot(session);
  }

  async executeCommands(
    userId: string,
    sessionId: string,
    commands: BrowserCommandInput[]
  ): Promise<BrowserCommandExecutionResult> {
    const session = this.requireOwnedSession(userId, sessionId);
    this.refreshIdleTimer(session);

    return this.enqueueCommand(session, async () => {
      let lastSummary = "Browser commands completed.";

      for (const command of commands) {
        lastSummary = await this.executeSingleCommand(session, command);
      }

      await this.captureFrame(session.sessionId);
      this.broadcast(session);

      return {
        ok: true,
        session: this.toSnapshot(session),
        summary: lastSummary,
        error: null,
      };
    });
  }

  attachSocket(sessionId: string, token: string, socket: WebSocket) {
    const session = this.sessions.get(sessionId);
    if (!session || session.streamToken !== token) {
      socket.close(1008, "Invalid browser session.");
      return;
    }

    session.sockets.add(socket);
    this.refreshIdleTimer(session);
    this.sendSnapshot(socket, session, { type: "session_snapshot" });

    socket.on("close", () => {
      session.sockets.delete(socket);
    });
  }

  async closeSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    this.sessions.delete(sessionId);
    session.status = "closed";

    if (session.captureTimer) {
      clearInterval(session.captureTimer);
      session.captureTimer = null;
    }

    if (session.idleTimer) {
      clearTimeout(session.idleTimer);
      session.idleTimer = null;
    }

    for (const socket of session.sockets) {
      if (socket.readyState === socket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "session_closed",
            session: this.toSnapshot(session),
          })
        );
      }
      socket.close();
    }

    session.sockets.clear();

    await Promise.allSettled([session.page.close(), session.context.close(), session.browser.close()]);
  }

  private requireOwnedSession(userId: string, sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId || session.status === "closed") {
      throw new Error("Browser session not found.");
    }

    return session;
  }

  private enqueueCommand(
    session: ManagedBrowserSession,
    executor: () => Promise<BrowserCommandExecutionResult>
  ) {
    const nextExecution = session.commandQueue.then(executor, executor);
    session.commandQueue = nextExecution.then(
      () => undefined,
      () => undefined
    );
    return nextExecution;
  }

  private async executeSingleCommand(
    session: ManagedBrowserSession,
    command: BrowserCommandInput
  ) {
    const timestamp = nowIso();
    const logEntry: BrowserActionLogEntry = {
      id: randomUUID(),
      action: command.action,
      target: command.target?.trim() || null,
      value: command.value ?? null,
      status: "running",
      message: `Running ${command.action}.`,
      timestamp,
    };

    session.status = "running";
    session.lastAction = logEntry;
    session.actionLog = trimActionLog([...session.actionLog, logEntry]);
    session.updatedAt = nowIso();
    this.broadcast(session);

    try {
      let summary = "";

      switch (command.action) {
        case "goto": {
          const url = normalizeUrlTarget(command.target ?? String(command.value ?? ""));
          await session.page.goto(url, { waitUntil: "domcontentloaded" });
          summary = `Opened ${url}.`;
          break;
        }
        case "click": {
          if (
            typeof command.x === "number" &&
            Number.isFinite(command.x) &&
            typeof command.y === "number" &&
            Number.isFinite(command.y)
          ) {
            await session.page.mouse.click(command.x, command.y);
            await session.page.waitForLoadState("domcontentloaded").catch(() => undefined);
            summary = `Clicked at (${Math.round(command.x)}, ${Math.round(command.y)}).`;
            break;
          }

          if (!command.target) {
            throw new Error("Click commands require a target or coordinates.");
          }
          const locator = await resolveClickLocator(session.page, command.target);
          await locator.click();
          await session.page.waitForLoadState("domcontentloaded").catch(() => undefined);
          summary = `Clicked ${command.target}.`;
          break;
        }
        case "type": {
          if (!command.target) {
            throw new Error("Type commands require a target.");
          }

          const value =
            typeof command.value === "number"
              ? String(command.value)
              : command.value ?? "";
          const locator = await resolveTypeLocator(session.page, command.target);
          await locator.fill(value);
          summary = `Typed into ${command.target}.`;
          break;
        }
        case "typeFocused": {
          const value =
            typeof command.value === "number"
              ? String(command.value)
              : command.value ?? "";

          if (!value) {
            throw new Error("Focused typing requires a value.");
          }

          await session.page.keyboard.type(value);
          summary = "Typed into the focused field.";
          break;
        }
        case "scroll": {
          const amount =
            typeof command.value === "number"
              ? command.value
              : Number(command.value ?? 700);
          const delta = Number.isFinite(amount) ? amount : 700;
          await session.page.mouse.wheel(0, delta);
          summary = `Scrolled ${delta}px.`;
          break;
        }
        case "back": {
          await session.page.goBack({ waitUntil: "domcontentloaded" }).catch(() => null);
          summary = session.page.url()
            ? `Went back to ${session.page.url()}.`
            : "Went back.";
          break;
        }
        case "forward": {
          await session.page.goForward({ waitUntil: "domcontentloaded" }).catch(() => null);
          summary = session.page.url()
            ? `Went forward to ${session.page.url()}.`
            : "Went forward.";
          break;
        }
        case "reload": {
          await session.page.reload({ waitUntil: "domcontentloaded" });
          summary = session.page.url()
            ? `Reloaded ${session.page.url()}.`
            : "Reloaded the page.";
          break;
        }
        case "press": {
          const key =
            typeof command.target === "string" && command.target.trim()
              ? command.target.trim()
              : typeof command.value === "string" && command.value.trim()
                ? command.value.trim()
                : "";

          if (!key) {
            throw new Error("Press commands require a key.");
          }

          await session.page.keyboard.press(key);
          summary = `Pressed ${key}.`;
          break;
        }
        default: {
          throw new Error(`Unsupported browser action "${String(command.action)}".`);
        }
      }

      session.status = "ready";
      session.currentUrl = session.page.url();
      session.title = await session.page.title().catch(() => null);
      session.updatedAt = nowIso();
      logEntry.status = "completed";
      logEntry.message = summary;
      session.lastAction = logEntry;
      session.actionLog = trimActionLog([
        ...session.actionLog.filter((entry) => entry.id !== logEntry.id),
        logEntry,
      ]);

      return summary;
    } catch (error) {
      const message = toErrorMessage(error);
      session.status = "failed";
      session.updatedAt = nowIso();
      logEntry.status = "failed";
      logEntry.message = message;
      session.lastAction = logEntry;
      session.actionLog = trimActionLog([
        ...session.actionLog.filter((entry) => entry.id !== logEntry.id),
        logEntry,
      ]);
      this.broadcast(session, {
        type: "command_error",
        error: message,
      });
      throw error;
    }
  }

  private toSnapshot(session: ManagedBrowserSession): BrowserSessionSnapshot {
    return {
      sessionId: session.sessionId,
      status: session.status,
      currentUrl: session.currentUrl,
      title: session.title,
      frameDataUrl: session.frameDataUrl,
      viewport: session.viewport,
      lastAction: session.lastAction,
      actionLog: session.actionLog,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      headless: session.headless,
      streamPort: session.streamPort,
      streamPath: session.streamPath,
      streamToken: session.streamToken,
    };
  }

  private startCaptureLoop(session: ManagedBrowserSession) {
    if (session.captureTimer) {
      return;
    }

    session.captureTimer = setInterval(() => {
      void this.captureFrame(session.sessionId);
    }, DEFAULT_BROWSER_CAPTURE_INTERVAL_MS);
  }

  private refreshIdleTimer(session: ManagedBrowserSession) {
    if (session.idleTimer) {
      clearTimeout(session.idleTimer);
    }

    session.idleTimer = setTimeout(() => {
      void this.closeSession(session.sessionId);
    }, DEFAULT_BROWSER_IDLE_TIMEOUT_MS);
  }

  private async captureFrame(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session || session.captureInFlight || session.status === "closed") {
      return;
    }

    session.captureInFlight = true;

    try {
      const buffer = await session.page.screenshot({
        type: "jpeg",
        quality: 65,
        animations: "disabled",
      });
      session.frameDataUrl = toDataUrl(buffer);
      session.currentUrl = session.page.url();
      session.title = await session.page.title().catch(() => null);
      session.updatedAt = nowIso();
      this.broadcast(session);
    } catch {
      // Ignore capture failures during navigation bursts.
    } finally {
      session.captureInFlight = false;
    }
  }

  private sendSnapshot(
    socket: WebSocket,
    session: ManagedBrowserSession,
    extraPayload?: Record<string, unknown>
  ) {
    if (socket.readyState !== socket.OPEN) {
      return;
    }

    socket.send(
      JSON.stringify({
        type: "frame",
        session: this.toSnapshot(session),
        ...extraPayload,
      })
    );
  }

  private broadcast(
    session: ManagedBrowserSession,
    extraPayload?: Record<string, unknown>
  ) {
    for (const socket of session.sockets) {
      this.sendSnapshot(socket, session, extraPayload);
    }
  }
}

export function getLiveBrowserSessionManager() {
  if (!globalThis.__rearvyLiveBrowserManager) {
    globalThis.__rearvyLiveBrowserManager = new LiveBrowserSessionManager();
  }

  return globalThis.__rearvyLiveBrowserManager;
}
