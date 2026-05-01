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
    const pythonPath = process.platform === "win32" 
      ? path.join(scriptsDir, ".venv", "Scripts", "python.exe")
      : path.join(scriptsDir, ".venv", "bin", "python");

    // If .venv doesn't exist, try using 'uv run'
    const useUv = !fs.existsSync(pythonPath);
    
    const command = useUv ? "uv" : pythonPath;
    const args = useUv 
      ? ["run", "--project", scriptsDir, "python", path.join(scriptsDir, "runner.py")]
      : [path.join(scriptsDir, "runner.py")];

    const child = spawn(command, args);
    
    let stdout = "";
    let stderr = "";

    child.stdin.write(task);
    child.stdin.end();

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        const parsed = parseBrowserRunnerOutput(stdout);
        if (parsed) {
          resolve(parsed);
          return;
        }

        resolve({
          ok: false,
          error: `Browser runner exited with code ${code}.${stderr.trim() ? ` Stderr: ${truncateOutput(stderr)}` : ""}${stdout.trim() ? ` Stdout: ${truncateOutput(stdout)}` : ""}`,
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
