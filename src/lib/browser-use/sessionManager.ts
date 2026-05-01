import { ChildProcess, spawn } from "child_process";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";

type SessionRecord = {
  id: string;
  task: string;
  child: ChildProcess;
  createdAt: number;
  stdout: string[];
  stderr: string[];
};

const sessions = new Map<string, SessionRecord>();

function pythonPathForScriptsDir(scriptsDir: string) {
  const pythonPath = process.platform === "win32"
    ? path.join(scriptsDir, ".venv", "Scripts", "python.exe")
    : path.join(scriptsDir, ".venv", "bin", "python");
  return pythonPath;
}

export function createSession(task: string): { ok: boolean; id?: string; error?: string } {
  try {
    const scriptsDir = path.join(process.cwd(), "scripts", "browser-use");
    const pythonPath = pythonPathForScriptsDir(scriptsDir);
    const useUv = !fs.existsSync(pythonPath);
    const command = useUv ? "uv" : pythonPath;
    const args = useUv
      ? ["run", "--project", scriptsDir, "python", path.join(scriptsDir, "runner.py"), task]
      : [path.join(scriptsDir, "runner.py"), task];

    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    const id = randomUUID();
    const rec: SessionRecord = {
      id,
      task,
      child,
      createdAt: Date.now(),
      stdout: [],
      stderr: [],
    };

    child.stdout.on("data", (chunk) => {
      const s = String(chunk);
      rec.stdout.push(s);
      // Keep stdout buffer limited
      if (rec.stdout.length > 200) rec.stdout.shift();
    });

    child.stderr.on("data", (chunk) => {
      const s = String(chunk);
      rec.stderr.push(s);
      if (rec.stderr.length > 200) rec.stderr.shift();
    });

    child.on("exit", (code) => {
      // mark session as closed by retaining exit marker in stderr
      rec.stderr.push(`__EXIT_CODE__:${code}`);
    });

    sessions.set(id, rec);

    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function sendCommandToSession(id: string, cmd: string): { ok: boolean; error?: string } {
  const rec = sessions.get(id);
  if (!rec) return { ok: false, error: "session_not_found" };
  const child = rec.child;
  if (!child || child.killed) return { ok: false, error: "session_not_running" };

  try {
    // send as raw text and newline
    child.stdin.write(cmd + "\n");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function closeSession(id: string): { ok: boolean; error?: string } {
  const rec = sessions.get(id);
  if (!rec) return { ok: false, error: "session_not_found" };
  try {
    const child = rec.child;
    if (!child.killed) {
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!child.killed) child.kill("SIGKILL");
      }, 3000);
    }
    sessions.delete(id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function getSession(id: string) {
  return sessions.get(id) || null;
}

export function listSessions() {
  return Array.from(sessions.values()).map((s) => ({ id: s.id, task: s.task, createdAt: s.createdAt }));
}
