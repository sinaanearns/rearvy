import { tool } from "ai";
import { z } from "zod";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import type { ToolContext } from "../types";

// Commands that are dangerous and should be blocked
const BLOCKED_PATTERNS = [
  /^sudo\s+/i,
  /rm\s+-rf\s+\//i,
  /del\s+\/s\s+\/q\s+\\/i,
  /:\s*\(/,
  /format\s+[a-z]:/i,
  /mkfs/i,
  /dd\s+if=.*of=/i,
];

// Commands that require confirmation
const RISKY_PATTERNS = [
  /^npm\s+uninstall\s+-g/i,
  /^pip\s+uninstall\s+-y/i,
  /\.rm\(/,
  /ShellScript.*rm/i,
];

function isCommandBlocked(command: string): boolean {
  return BLOCKED_PATTERNS.some((pattern) => pattern.test(command));
}

function isCommandRisky(command: string): boolean {
  return RISKY_PATTERNS.some((pattern) => pattern.test(command));
}

type ShellResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

function runShellCommand(command: string, cwd: string, timeoutMs = 60000): Promise<ShellResult> {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === "win32";
    const primary = isWindows
      ? { cmd: "powershell.exe", args: ["-NoProfile", "-NonInteractive", "-Command", command] }
      : { cmd: "/bin/sh", args: ["-lc", command] };

    const fallback = isWindows
      ? { cmd: "cmd.exe", args: ["/d", "/s", "/c", command] }
      : null;

    const attempt = (spec: { cmd: string; args: string[] }, onFail?: (error: NodeJS.ErrnoException) => void) => {
      const child = spawn(spec.cmd, spec.args, {
        cwd,
        env: { ...process.env },
        windowsHide: true,
      });

      let stdout = "";
      let stderr = "";
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill();
        reject(new Error(`Command timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      child.on("error", (error: NodeJS.ErrnoException) => {
        clearTimeout(timer);
        if (settled) return;
        settled = true;
        if (onFail) {
          onFail(error);
          return;
        }
        reject(error);
      });

      child.on("close", (code) => {
        clearTimeout(timer);
        if (settled) return;
        settled = true;
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: typeof code === "number" ? code : 1,
        });
      });
    };

    attempt(primary, (error) => {
      if (fallback && error.code === "ENOENT") {
        attempt(fallback);
        return;
      }
      reject(error);
    });
  });
}

export function runTerminalCommand(ctx: ToolContext) {
  return tool({
    description:
      "Run a terminal command and get the output. Useful for npm commands, Python scripts, git operations, building, testing, and other CLI tasks. This runs on the local machine where Rearvy is running.",
    inputSchema: z.object({
      command: z
        .string()
        .describe(
          "The terminal command to run (e.g., 'npm run build', 'git status', 'python script.py'). Use forward slashes for paths."
        ),
      cwd: z
        .string()
        .optional()
        .describe("Working directory to run the command in. Defaults to project root."),
    }),
    execute: async ({ command, cwd = process.cwd() }) => {
      // Security checks
      if (isCommandBlocked(command)) {
        return {
          ok: false,
          error: "Command blocked for safety reasons",
          command,
        };
      }

      const isRisky = isCommandRisky(command);

      try {
        // Log command execution for audit trail
        console.log(`[Terminal] Running command: ${command} in ${cwd}`);

        const { stdout, stderr, exitCode } = await runShellCommand(command, cwd, 60000);

        const output = stdout || "";
        const errorOutput = stderr || "";

        if (exitCode !== 0) {
          return {
            ok: false,
            command,
            exitCode,
            stdout: output,
            stderr: errorOutput,
            error: `Command exited with code ${exitCode}`,
          };
        }

        return {
          ok: true,
          command,
          exitCode,
          stdout: output.trim(),
          stderr: errorOutput.trim(),
          hasWarnings: isRisky,
          warning: isRisky
            ? "This is a risky operation. Review the command and output carefully."
            : undefined,
        };
      } catch (error) {
        const err = error as any;
        const exitCode = typeof err?.code === "number" ? err.code : 1;
        const stdout = err?.stdout ? err.stdout.toString().trim() : "";
        const stderr = err?.stderr ? err.stderr.toString().trim() : err?.message || "Unknown error";

        console.error(`[Terminal] Command failed: ${command}`, {
          exitCode,
          stderr,
        });

        return {
          ok: false,
          command,
          exitCode,
          stdout,
          stderr,
          error: `Command exited with code ${exitCode}`,
        };
      }
    },
  });
}

export function listDirectoryTool(ctx: ToolContext) {
  void ctx;
  return tool({
    description: "List files and directories in a folder",
    inputSchema: z.object({
      path: z
        .string()
        .optional()
        .describe("Path to list. Defaults to current working directory."),
    }),
    execute: async ({ path = "." }) => {
      try {
        const targetPath = path;
        const entries = await fs.readdir(targetPath, { withFileTypes: true });
        const contents = entries
          .map((entry) => `${entry.isDirectory() ? "[DIR]" : "[FILE]"} ${entry.name}`)
          .join("\n");
        return {
          ok: true,
          path,
          contents,
        };
      } catch (error) {
        const err = error as any;
        return {
          ok: false,
          path,
          error: err.message,
        };
      }
    },
  });
}

export function readFileTool(ctx: ToolContext) {
  void ctx;
  return tool({
    description: "Read the contents of a text file",
    inputSchema: z.object({
      filePath: z.string().describe("Path to the file to read"),
      lines: z
        .object({
          start: z.number().optional().describe("Start line number (1-based)"),
          end: z.number().optional().describe("End line number (1-based)"),
        })
        .optional()
        .describe("Optional line range to read"),
    }),
    execute: async ({ filePath, lines }) => {
      try {
        const resolvedPath = path.resolve(filePath);
        const raw = await fs.readFile(resolvedPath, "utf8");
        let content = raw;

        if (lines) {
          const allLines = raw.split(/\r?\n/);
          const start = Math.max(1, lines.start || 1);
          const end = Math.max(start, lines.end || allLines.length);
          content = allLines.slice(start - 1, end).join("\n");
        }

        return {
          ok: true,
          filePath,
          content,
          lineRange: lines,
        };
      } catch (error) {
        const err = error as any;
        return {
          ok: false,
          filePath,
          error: err.message,
        };
      }
    },
  });
}
