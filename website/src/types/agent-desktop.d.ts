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
  // Diagnostics and observation only. OS-changing calls are deliberately
  // exposed through window.electron.automation approval-gated workflows.
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

  // Window / App
  listWindows(filter?: { app?: string }, opts?: { sessionId?: string }): Promise<{ windows: AgentDesktopWindow[] }>;
  listApps(appFilter?: string, opts?: { sessionId?: string }): Promise<{ apps: AgentDesktopApp[] }>;
  listDisplays(opts?: { sessionId?: string }): Promise<{ displays: AgentDesktopDisplay[] }>;

  // Session
  sessionList(): Promise<{ sessions: AgentDesktopSession[] }>;

  // Trace
  traceShow(sessionId: string, limit?: number): Promise<{ events: unknown[] }>;
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
