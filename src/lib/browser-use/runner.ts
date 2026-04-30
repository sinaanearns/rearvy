import { spawn } from "child_process";
import path from "path";
import fs from "fs";

export interface BrowserUseResult {
  ok: boolean;
  summary?: string;
  error?: string;
  status: string;
}

export async function runBrowserAgent(task: string): Promise<BrowserUseResult> {
  return new Promise((resolve, reject) => {
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
        resolve({
          ok: false,
          error: `Process exited with code ${code}. Stderr: ${stderr}`,
          status: "failed",
        });
        return;
      }

      try {
        // Try to find the last line that is valid JSON
        const lines = stdout.trim().split("\n");
        const lastLine = lines[lines.length - 1];
        const result = JSON.parse(lastLine);
        resolve(result);
      } catch (e) {
        resolve({
          ok: false,
          error: `Failed to parse output: ${stdout}. Error: ${e}`,
          status: "failed",
        });
      }
    });
  });
}
