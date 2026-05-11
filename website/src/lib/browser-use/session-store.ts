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
const IS_VERCEL = Boolean(process.env.VERCEL);

function ensureDir() {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

export type PersistedSession = {
  id: string;
  task: string;
  createdAt: number;
  userId?: string;
  stdout: string[];
  stderr: string[];
  isRunning: boolean;
  pid?: number;
};

export function writeSession(data: PersistedSession): void {
  // Avoid writing files in serverless/edge environments (e.g. Vercel)
  if (IS_VERCEL) return;

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
  if (IS_VERCEL) return null;

  const filePath = path.join(SESSIONS_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as PersistedSession;
  } catch {
    return null;
  }
}

export function deleteSession(id: string): void {
  if (IS_VERCEL) return;

  const filePath = path.join(SESSIONS_DIR, `${id}.json`);
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // ignore
  }
}
