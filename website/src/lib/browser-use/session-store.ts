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
  } catch {
    // Ignore lock cleanup errors
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
    console.error(`Failed to write session ${data.id}:`, error);
    // Non-fatal — in-memory store is still the source of truth
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

    return JSON.parse(fs.readFileSync(filePath, "utf8")) as PersistedSession;
  } catch (error) {
    console.error(`Failed to read session ${id}:`, error);
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
    console.error(`Failed to delete session ${id}:`, error);
  } finally {
    releaseLock(id);
  }
}
