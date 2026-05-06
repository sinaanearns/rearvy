/**
 * File-based browser session store.
 *
 * Writes session metadata to the OS temp directory so that every Next.js API
 * route (which may be in separate Turbopack module bundles) can read/write
 * session state without relying on a shared in-memory singleton.
 */

import fs from "fs";
import path from "path";
import os from "os";

const SESSIONS_DIR = path.join(os.tmpdir(), "rearvy-browser-sessions");

export type BrowserSessionEvent = {
  id: string;
  kind: string;
  timestamp: number;
  channel?: "stdout" | "stderr" | "command" | "system";
  message?: string;
  task?: string;
  command?: string;
  mode?: "auto" | "task" | "python";
  step?: number;
  totalSteps?: number;
  url?: string | null;
  liveUrl?: string | null;
  title?: string | null;
  evaluation?: string | null;
  memory?: string | null;
  nextGoal?: string | null;
  actions?: unknown[];
  output?: unknown;
  error?: string | null;
  result?: unknown;
};

function ensureDir() {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

export type PersistedSession = {
  id: string;
  task: string;
  createdAt: number;
  stdout: string[];
  stderr: string[];
  events: BrowserSessionEvent[];
  isRunning: boolean;
  pid?: number;
  exitCode?: number | null;
  signalCode?: string | null;
  endedAt?: number | null;
};

export function writeSession(data: PersistedSession): void {
  ensureDir();
  try {
    fs.writeFileSync(
      path.join(SESSIONS_DIR, `${data.id}.json`),
      JSON.stringify(data),
      "utf8"
    );
  } catch {
    // Non-fatal — in-memory store is still the source of truth
  }
}

export function readSession(id: string): PersistedSession | null {
  const filePath = path.join(SESSIONS_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as PersistedSession;
  } catch {
    return null;
  }
}

export function deleteSession(id: string): void {
  const filePath = path.join(SESSIONS_DIR, `${id}.json`);
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // ignore
  }
}
