import { spawn } from "child_process";
import path from "path";
import fs from "fs";

export interface BrowserUseResult {
  ok: boolean;
  summary?: string;
  error?: string;
  status: string;
}

function truncateOutput(value: string, maxLength = 1200) {
  const normalized = value.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  const headLength = Math.floor(maxLength * 0.7);
  const tailLength = maxLength - headLength;
  return `${normalized.slice(0, headLength)}... [truncated ${normalized.length - maxLength} chars] ...${normalized.slice(-tailLength)}`;
}

function parseBrowserRunnerOutput(stdout: string) {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    try {
      const parsed = JSON.parse(line) as BrowserUseResult;
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch {
      // Keep scanning upward for the last JSON payload.
    }
  }

  return null;
}

export async function runBrowserAgent(task: string): Promise<BrowserUseResult> {
  return new Promise((resolve) => {
    const scriptsDir = path.join(process.cwd(), "scripts", "browser-use");
    const candidates = [
      path.join(scriptsDir, ".venv", "Scripts", "python.exe"),
      path.join(scriptsDir, ".venv", "bin", "python"),
      path.join(scriptsDir, "venv", "Scripts", "python.exe"),
      path.join(scriptsDir, "venv", "bin", "python"),
      path.join(process.cwd(), ".venv", "Scripts", "python.exe"),
      path.join(process.cwd(), ".venv", "bin", "python"),
    ];

    let pythonPath = candidates.find(c => fs.existsSync(c));
    const useUv = !pythonPath;
    
    const command = pythonPath || "uv";
    const args = useUv 
      ? ["run", "--project", scriptsDir, "python", path.join(scriptsDir, "runner.py"), task]
      : [path.join(scriptsDir, "runner.py"), task];

    const timeoutMsEnv = Number.parseInt(process.env.BROWSER_USE_TIMEOUT_MS ?? "45000", 10);
    const timeoutMs = Number.isFinite(timeoutMsEnv) && timeoutMsEnv > 0 ? timeoutMsEnv : 45000;

    const child = spawn(command, args, {
      shell: process.platform === "win32",
    });
    
    // Use the configured Browser Use timeout, with a safe fallback.
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5000); // Force kill after 5 more seconds
      resolve({
        ok: false,
        error: `Browser task exceeded ${Math.round(timeoutMs / 1000)}-second timeout. The browser automation took too long to complete.`,
        status: "timeout",
      });
    }, timeoutMs);
    
    let stdout = "";
    let stderr = "";

    // Pass task as a command-line argument so the runner doesn't rely on piped stdin.
    // Keep stdin open in case the runner enters keep-open mode and expects commands later.

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        const parsed = parseBrowserRunnerOutput(stdout);
        if (parsed) {
          resolve(parsed);
          return;
        }

        resolve({
          ok: false,
          error: `Browser runner exited with code ${code}.${stderr.trim() ? ` Stderr: ${truncateOutput(stderr)}` : ""}${stdout.trim() ? ` Stdout: ${truncateOutput(stdout)}` : ""} (Command: ${command}, PythonPath: ${pythonPath}, ScriptsDir: ${scriptsDir})`,
          status: "failed",
        });
        return;
      }

      try {
        const parsed = parseBrowserRunnerOutput(stdout);
        if (parsed) {
          resolve(parsed);
          return;
        }

        resolve({
          ok: false,
          error: `Browser runner completed without a JSON result. Stdout: ${truncateOutput(stdout)}`,
          status: "failed",
        });
      } catch (e) {
        resolve({
          ok: false,
          error: `Failed to parse browser output. ${e instanceof Error ? e.message : String(e)}. Stdout: ${truncateOutput(stdout)}`,
          status: "failed",
        });
      }
    });
  });
}
