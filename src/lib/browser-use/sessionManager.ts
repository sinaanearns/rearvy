/**
 * Browser Session Manager
 *
 * Lightweight in-process manager for browser-use subprocess sessions.
 * Persists across Next.js API route invocations via a module-level Map.
 * Works on Windows and Unix; spawns `uv run` or falls back to python/python3.
 */

import { spawn, type ChildProcess } from "child_process";
import path from "path";
import { randomUUID } from "crypto";

export type BrowserSession = {
  id: string;
  task: string;
  createdAt: number;
  child: ChildProcess;
  stdout: string[];
  stderr: string[];
};

// Module-level singleton – survives across hot-reloads in development too
const sessions: Map<string, BrowserSession> = (globalThis as any).__browserSessions ??
  ((globalThis as any).__browserSessions = new Map());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveRunnerArgs(): { cmd: string; args: string[] } {
  // Prefer uv if configured; otherwise fall back to plain python
  const useUv = process.env.BROWSER_USE_USE_UV !== "false";
  if (useUv) {
    const uvPath = process.env.UV_PATH || "uv";
    return { cmd: uvPath, args: ["run", "python"] };
  }
  const python = process.env.PYTHON_PATH || (process.platform === "win32" ? "python" : "python3");
  return { cmd: python, args: [] };
}

function resolveScriptPath(): string {
  return (
    process.env.BROWSER_USE_SCRIPT_PATH ||
    path.join(process.cwd(), "scripts", "browser-use", "runner.py")
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createSession(task: string): { ok: true; id: string } | { ok: false; error: string } {
  try {
    const { cmd, args } = resolveRunnerArgs();
    const scriptPath = resolveScriptPath();
    const id = randomUUID();

    const child = spawn(
      cmd,
      [...args, scriptPath, "--task", task, "--keep-open"],
      {
        env: {
          ...process.env,
          BROWSER_USE_TASK: task,
        },
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      }
    );

    const session: BrowserSession = {
      id,
      task,
      createdAt: Date.now(),
      child,
      stdout: [],
      stderr: [],
    };

    child.stdout?.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n").filter(Boolean);
      session.stdout.push(...lines);
      // Keep the last 500 lines to avoid memory bloat
      if (session.stdout.length > 500) {
        session.stdout = session.stdout.slice(-500);
      }
    });

    child.stderr?.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n").filter(Boolean);
      session.stderr.push(...lines);
      if (session.stderr.length > 200) {
        session.stderr = session.stderr.slice(-200);
      }
    });

    child.on("exit", (code) => {
      const s = sessions.get(id);
      if (s) {
        s.stdout.push(`__EXIT_CODE__${code ?? "null"}`);
      }
    });

    sessions.set(id, session);
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function getSession(id: string): BrowserSession | undefined {
  return sessions.get(id);
}

export function sendCommandToSession(
  id: string,
  command: string
): { ok: true } | { ok: false; error: string } {
  const session = sessions.get(id);
  if (!session) {
    return { ok: false, error: `Session ${id} not found.` };
  }

  if (session.child.killed || !session.child.stdin) {
    return { ok: false, error: `Session ${id} is no longer running.` };
  }

  try {
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
    if (!session.child.killed) {
      session.child.kill("SIGTERM");
    }
    sessions.delete(id);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function listSessions(): BrowserSession[] {
  return Array.from(sessions.values());
}
