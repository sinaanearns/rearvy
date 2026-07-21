/**
 * TypeScript type declarations for window.electron.agentDesktop
 *
 * The bridge is exposed by desktop-app/preload.cjs via contextBridge.
 * On the web (non-Electron) this namespace is absent, so callers must
 * guard with: if (window.electron?.agentDesktop) { ... }
 */

// ─── Shared response types ────────────────────────────────────────────────────

export interface AgentDesktopOk<T = unknown> {
  ok: true;
  command: string;
  version: string;
  data: T;
}

export interface AgentDesktopErr {
  ok: false;
  command: string;
  version: string;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type AgentDesktopResult<T = unknown> = AgentDesktopOk<T> | AgentDesktopErr;

// ─── Observation types ────────────────────────────────────────────────────────

export interface AgentDesktopElement {
  ref: string;
  role: string;
  name?: string;
  value?: string;
  enabled?: boolean;
  visible?: boolean;
  focused?: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  children?: AgentDesktopElement[];
}

export interface AgentDesktopSnapshot {
  snapshot_id: string;
  app?: string;
  elements: AgentDesktopElement[];
  timestamp: string;
}

export interface AgentDesktopScreenshot {
  base64: string;
  mime: string;
  width: number;
  height: number;
  snapshot_id?: string;
}

// ─── Window / App types ───────────────────────────────────────────────────────

export interface AgentDesktopWindow {
  id: string | number;
  title: string;
  app?: string;
  visible?: boolean;
  focused?: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface AgentDesktopApp {
  name: string;
  pid?: number;
  bundle_id?: string;
  windows?: AgentDesktopWindow[];
}

export interface AgentDesktopDisplay {
  index: number;
  id: string;
  width: number;
  height: number;
  x: number;
  y: number;
  primary?: boolean;
}

// ─── Session types ────────────────────────────────────────────────────────────

export interface AgentDesktopSession {
  session_id: string;
  name?: string;
  created_at: string;
  sealed_at?: string;
}

// ─── Interaction option types ─────────────────────────────────────────────────

export interface ClickOptions {
  button?: "left" | "right" | "middle";
  count?: number;
  sessionId?: string;
}

export interface FindFilter {
  role?: string;
  name?: string;
  value?: string;
  text?: string;
  app?: string;
  limit?: number;
}

export interface WaitCondition {
  ms?: number;
  element?: string;
  predicate?: string;
  value?: string;
  snapshot?: string;
  window?: string;
  text?: string;
  app?: string;
  timeout?: number;
}

// ─── Status types ─────────────────────────────────────────────────────────────

export interface AgentDesktopStatus {
  platform: string;
  os: string;
  snapshot_id?: string;
  accessibility?: "Granted" | "Denied" | "Unknown";
  screen_recording?: "Granted" | "Denied" | "Unknown";
}

export interface AgentDesktopHealth {
  available: boolean;
  version?: string;
  platform?: string;
  binaryPath?: string;
  error?: string;
}

// ─── Main interface ───────────────────────────────────────────────────────────

export interface AgentDesktopBridge {
  // Core / escape-hatch
  runCommand(args: string[], opts?: Record<string, unknown>): Promise<AgentDesktopResult>;
  health(): Promise<AgentDesktopHealth>;
  status(): Promise<AgentDesktopStatus>;
  permissions(): Promise<Record<string, string>>;
  version(): Promise<{ version: string; os: string }>;

  // Observation
  snapshot(app?: string | null, opts?: {
    interactive?: boolean;
    compact?: boolean;
    skeleton?: boolean;
    sessionId?: string;
    timeoutMs?: number;
  }): Promise<AgentDesktopSnapshot>;
  find(filter?: FindFilter, opts?: { sessionId?: string }): Promise<AgentDesktopElement[]>;
  screenshot(opts?: {
    app?: string;
    windowId?: string | number;
    displayIndex?: number;
    sessionId?: string;
    timeoutMs?: number;
  }): Promise<AgentDesktopScreenshot>;

  // Interaction
  click(refId: string, snapshotId?: string, opts?: ClickOptions): Promise<void>;
  type(refId: string, text: string, snapshotId?: string, opts?: { sessionId?: string }): Promise<void>;
  press(combo: string, opts?: { sessionId?: string }): Promise<void>;
  scroll(
    refId: string,
    direction: "up" | "down" | "left" | "right",
    amount?: number,
    snapshotId?: string,
    opts?: { sessionId?: string }
  ): Promise<void>;
  wait(condition: WaitCondition, opts?: { sessionId?: string }): Promise<void>;

  // Mouse
  mouseMove(x: number, y: number, opts?: { sessionId?: string }): Promise<void>;
  mouseClick(x: number, y: number, opts?: ClickOptions): Promise<void>;
  mouseWheel(x: number, y: number, dx: number, dy: number, opts?: { sessionId?: string }): Promise<void>;
  drag(
    from: { ref: string } | { x: number; y: number },
    to: { ref: string } | { x: number; y: number },
    opts?: { sessionId?: string }
  ): Promise<void>;
  hover(
    refOrXy: string | { x: number; y: number },
    opts?: { sessionId?: string }
  ): Promise<void>;

  // Clipboard
  clipboardGet(opts?: { sessionId?: string }): Promise<string>;
  clipboardSet(text: string, opts?: { sessionId?: string }): Promise<void>;
  clipboardClear(opts?: { sessionId?: string }): Promise<void>;

  // Window / App
  listWindows(filter?: { app?: string }, opts?: { sessionId?: string }): Promise<{ windows: AgentDesktopWindow[] }>;
  listApps(appFilter?: string, opts?: { sessionId?: string }): Promise<{ apps: AgentDesktopApp[] }>;
  listDisplays(opts?: { sessionId?: string }): Promise<{ displays: AgentDesktopDisplay[] }>;
  focusWindow(target: { app?: string; windowId?: string | number }, opts?: { sessionId?: string }): Promise<void>;
  launch(appName: string, opts?: { sessionId?: string; timeoutMs?: number }): Promise<void>;
  closeApp(appName: string, force?: boolean, opts?: { sessionId?: string }): Promise<void>;

  // Session
  sessionStart(name?: string, screenshots?: boolean): Promise<{ session_id: string }>;
  sessionEnd(sessionId: string): Promise<void>;
  sessionList(): Promise<{ sessions: AgentDesktopSession[] }>;
  sessionGc(): Promise<{ removed: number }>;

  // Trace
  traceShow(sessionId: string, limit?: number): Promise<{ events: unknown[] }>;
  traceExport(sessionId: string, out?: string): Promise<{ path: string }>;

  // Batch
  batch(
    commands: Array<{ command: string; args: string[] }>,
    opts?: { sessionId?: string; timeoutMs?: number }
  ): Promise<AgentDesktopResult[]>;
}

// ─── Augment window.electron ──────────────────────────────────────────────────

declare global {
  interface Window {
    electron?: {
      agentDesktop?: AgentDesktopBridge;
      [key: string]: unknown;
    };
  }
}
