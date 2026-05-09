import { tool } from "ai";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import type { ToolContext } from "../types";

const execAsync = promisify(exec);

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

        const { stdout, stderr } = await execAsync(command, {
          cwd,
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
          timeout: 60000, // 60 second timeout
        });

        const exitCode = 0;
        const output = stdout || "";
        const errorOutput = stderr || "";

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
        const exitCode = err.code || 1;
        const stdout = err.stdout ? err.stdout.toString().trim() : "";
        const stderr = err.stderr ? err.stderr.toString().trim() : err.message;

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
        const { stdout } = await execAsync(`ls -la "${path}"`, {
          maxBuffer: 5 * 1024 * 1024,
          timeout: 10000,
        });
        return {
          ok: true,
          path,
          contents: stdout.trim(),
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
        let command = `cat "${filePath}"`;

        if (lines) {
          const start = lines.start || 1;
          const end = lines.end || -1;
          command = `sed -n '${start},${end}p' "${filePath}"`;
        }

        const { stdout } = await execAsync(command, {
          maxBuffer: 5 * 1024 * 1024,
          timeout: 10000,
        });

        return {
          ok: true,
          filePath,
          content: stdout.trim(),
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
