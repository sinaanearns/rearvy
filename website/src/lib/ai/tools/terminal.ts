import { tool } from "ai";
import { z } from "zod";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import type { ToolContext } from "../types";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("TerminalTool");

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

// Shell/file tools are only meant to run on the user's own machine via the
// Rearvy desktop app. On hosted/serverless deployments the API route runs on a
// shared server, so executing shell commands there would be remote code
// execution. Refuse to run in those environments regardless of request flags.
function isHostedServerRuntime(): boolean {
  return Boolean(
    process.env.VERCEL ||
      process.env.CF_PAGES ||
      process.env.WORKERS_CI ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.NETLIFY
  );
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toTrimmedString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (Buffer.isBuffer(value)) return value.toString().trim();
  if (value instanceof Uint8Array) return Buffer.from(value).toString().trim();
  return String(value).trim();
}

function errorMessage(error: unknown, fallback = "Unknown error"): string {
  if (error instanceof Error) return error.message;
  if (isRecord(error)) {
    const message = toTrimmedString(error.message);
    if (message) return message;
  }

  return toTrimmedString(error) || fallback;
}

function errorExitCode(error: unknown): number {
  if (!isRecord(error)) return 1;

  const { code } = error;
  if (typeof code === "number" && Number.isFinite(code)) return code;
  if (typeof code === "string") {
    const parsed = Number.parseInt(code, 10);
    if (Number.isFinite(parsed)) return parsed;
  }

  return 1;
}

function errorOutput(error: unknown, property: "stdout" | "stderr"): string {
  return isRecord(error) ? toTrimmedString(error[property]) : "";
}

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

export function runTerminalCommand(_ctx: ToolContext) {
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
      if (isHostedServerRuntime()) {
        return {
          ok: false,
          error:
            "Terminal commands can only run in the Rearvy desktop app, not on the hosted server.",
          command,
        };
      }
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
        log.info("Running command", { cwd, commandLength: command.length, risky: isRisky });

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
        const exitCode = errorExitCode(error);
        const stdout = errorOutput(error, "stdout");
        const stderr = errorOutput(error, "stderr") || errorMessage(error);

        log.error("Command failed", {
          exitCode,
          stderr,
          commandLength: command.length,
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
      if (isHostedServerRuntime()) {
        return {
          ok: false,
          path,
          error: "File access is only available in the Rearvy desktop app.",
        };
      }
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
        return {
          ok: false,
          path,
          error: errorMessage(error),
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
      if (isHostedServerRuntime()) {
        return {
          ok: false,
          filePath,
          error: "File access is only available in the Rearvy desktop app.",
        };
      }
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
        return {
          ok: false,
          filePath,
          error: errorMessage(error),
        };
      }
    },
  });
}

export function writeFileTool(ctx: ToolContext) {
  void ctx;
  return tool({
    description: "Write content to a file (creates directories if missing). Overwrites file if exists.",
    inputSchema: z.object({
      filePath: z.string().describe("Path to the file to write"),
      content: z.string().describe("Text content to write to the file"),
    }),
    execute: async ({ filePath, content }) => {
      if (isHostedServerRuntime()) {
        return {
          ok: false,
          filePath,
          error: "File access is only available in the Rearvy desktop app.",
        };
      }
      try {
        const resolvedPath = path.resolve(filePath);
        await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
        await fs.writeFile(resolvedPath, content, "utf8");
        return {
          ok: true,
          filePath,
          message: `Successfully wrote ${content.length} characters to ${filePath}`,
        };
      } catch (error) {
        return {
          ok: false,
          filePath,
          error: errorMessage(error),
        };
      }
    },
  });
}

export function appendFileTool(ctx: ToolContext) {
  void ctx;
  return tool({
    description: "Append content to the end of a file.",
    inputSchema: z.object({
      filePath: z.string().describe("Path to the file to append to"),
      content: z.string().describe("Text content to append"),
    }),
    execute: async ({ filePath, content }) => {
      if (isHostedServerRuntime()) {
        return {
          ok: false,
          filePath,
          error: "File access is only available in the Rearvy desktop app.",
        };
      }
      try {
        const resolvedPath = path.resolve(filePath);
        await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
        await fs.appendFile(resolvedPath, content, "utf8");
        return {
          ok: true,
          filePath,
          message: `Successfully appended ${content.length} characters to ${filePath}`,
        };
      } catch (error) {
        return {
          ok: false,
          filePath,
          error: errorMessage(error),
        };
      }
    },
  });
}

