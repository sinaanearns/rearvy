import { tool } from "ai";
import { z } from "zod";
import { spawn } from "child_process";
import type { ToolContext } from "../types";
import { sanitizeAssistantText } from "@/lib/ai/sanitize";
import { inferQuickStartUrl } from "@/lib/ai/browser-navigation";
import {
  closeSession,
  createSession,
  getSession,
  sendCommandToSession,
} from "@/lib/browser-use/sessionManager";

import { runBrowserAgent } from "@/lib/browser-use/runner";
import { runDemoBrowserAgent, getDemoBrowserMessage } from "@/lib/browser-use/demo-agent";

const browserCommandSchema = z
  .object({
    action: z.string().min(1),
    target: z.string().optional(),
    selector: z.string().optional(),
    value: z.string().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    amount: z.number().optional(),
    key: z.string().optional(),
  })
  .passthrough();

function buildSessionSnapshot(sessionId: string) {
  const session = getSession(sessionId);
  if (!session) {
    return null;
  }

  const stdout = session.stdout.slice(-20);
  const stderr = session.stderr
    .filter((line) => !line.startsWith("__EXIT_CODE__:"))
    .slice(-20);
  const exitMarker = session.stderr.find((line) =>
    line.startsWith("__EXIT_CODE__:")
  );
  const exitCode = exitMarker
    ? Number(exitMarker.replace("__EXIT_CODE__:", ""))
    : null;
  const status =
    session.child.exitCode === null && !session.child.killed
      ? "running"
      : exitCode === 0
        ? "completed"
        : exitCode === null
          ? "closed"
          : "failed";

  return {
    ok: true,
    browserSessionId: session.id,
    sessionId: session.id,
    task: session.task,
    createdAt: session.createdAt,
    pid: session.child.pid ?? null,
    status,
    stdout,
    stderr,
    lastOutput: [...stdout, ...stderr].filter(Boolean).at(-1) ?? null,
    summary: `AI is controlling: ${session.task}`,
  };
}

function isSimpleOpenCommand(task: string) {
  const normalized = task.trim();
  if (!normalized) {
    return false;
  }

  if (!/^(open|go to|goto|visit|navigate to|browse to|load|launch)\b/i.test(normalized)) {
    return false;
  }

  if (/\b(search|find|click|fill|type|submit|login|log in|sign in|buy|checkout)\b/i.test(normalized)) {
    return false;
  }

  return normalized.split(/\s+/).length <= 8;
}

async function openExternalUrl(url: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const command =
      process.platform === "win32"
        ? "cmd"
        : process.platform === "darwin"
          ? "open"
          : "xdg-open";
    const args =
      process.platform === "win32"
        ? ["/c", "start", "", url]
        : [url];

    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });

    child.on("error", reject);
    child.unref();
    resolve();
  });
}

/**
 * Run an autonomous browser agent using the browser-use framework.
 * This tool allows the AI to navigate websites, click buttons, type text, and extract data.
 */
export function runBrowserAgentTool(ctx: ToolContext) {
  return tool({
    description: "Run an autonomous browser agent to perform a task on a website. The agent will navigate, click, type, and extract information as needed to accomplish the task.",
    inputSchema: z.object({
      task: z.string().min(5).describe("The task for the browser agent to perform (e.g., 'Go to google.com and search for the latest news about AI')"),
    }),
    execute: async ({ task }) => {
      // Browser automation now available for web and desktop users

      // Fast path: open simple known websites instantly without running the full agent.
      if (isSimpleOpenCommand(task)) {
        const quickUrl = inferQuickStartUrl(task);
        if (quickUrl) {
          try {
            await openExternalUrl(quickUrl);
            return {
              ok: true,
              status: "completed",
              summary: `Opened ${quickUrl} in your browser.`,
              action: "quickOpen",
              task,
              startUrl: quickUrl,
            };
          } catch (error) {
            console.warn("Quick browser open failed, falling back to browser agent", {
              error: error instanceof Error ? error.message : String(error),
              quickUrl,
            });
          }
        }
      }

      // For real browser workflows, create a persistent local session so the model can continue
      // with follow-up actions using controlBrowserSession.
      const sessionResult = createSession(task);
      if (sessionResult.ok && sessionResult.id) {
        const snapshot = buildSessionSnapshot(sessionResult.id);
        if (snapshot) {
          return {
            ...snapshot,
            action: "runBrowserAgent",
            task,
          };
        }

        return {
          ok: true,
          status: "running",
          summary: `Started browser session for: ${task}`,
          action: "runBrowserAgent",
          task,
          browserSessionId: sessionResult.id,
          sessionId: sessionResult.id,
        };
      }

      try {
        const result = await runBrowserAgent(task);
        
        // If browser-use free tier LLM Gateway fails, use demo mode instead
        if (
          result.ok === false &&
          (result.error?.includes("Free tier") ||
            result.error?.includes("LLM Gateway") ||
            result.error?.includes("subscription"))
        ) {
          // Fall back to demo mode
          const demoResult = await runDemoBrowserAgent(task);
          const demoBrowserMsg = getDemoBrowserMessage();
          
          return {
            ...demoResult,
            action: "runBrowserAgent",
            task: task,
            demoMode: true,
            demoMessage: demoBrowserMsg,
            summary: demoResult.summary
              ? `[Demo Mode] ${demoResult.summary}\n\n${demoBrowserMsg}`
              : demoResult.summary,
          };
        }
        
        // If browser-use is unavailable, provide helpful feedback
        if (result.ok === false) {
          const errorMsg = result.error || "";
          if (errorMsg.includes("BROWSER_USE_API_KEY") || errorMsg.includes("not configured")) {
            return {
              ok: false,
              status: "unavailable",
              message: "Browser automation requires setup: Get BROWSER_USE_API_KEY from https://cloud.browser-use.com/new-api-key",
              action: "runBrowserAgent",
              task: task,
            };
          }
        }
        
        const summary =
          typeof result.summary === "string"
            ? sanitizeAssistantText(result.summary)
            : result.summary;
        const error =
          typeof result.error === "string"
            ? sanitizeAssistantText(result.error)
            : result.error;

        return {
          ...result,
          summary,
          error,
          action: "runBrowserAgent",
          task: task,
        };
      } catch (error) {
        // If runner itself fails, fall back to demo
        const demoResult = await runDemoBrowserAgent(task);
        const demoBrowserMsg = getDemoBrowserMessage();
        
        return {
          ...demoResult,
          action: "runBrowserAgent",
          task: task,
          demoMode: true,
          demoMessage: demoBrowserMsg,
          summary: demoResult.summary
            ? `[Demo Mode] ${demoResult.summary}\n\n${demoBrowserMsg}`
            : demoResult.summary,
        };
      }
    },
  });
}

export function controlBrowserSessionTool(ctx: ToolContext) {
  return tool({
    description:
      "Continue an existing browser session with structured commands or a short natural-language instruction.",
    inputSchema: z.object({
      browserSessionId: z.string().min(1).describe("Active browser session ID returned by runBrowserTask."),
      instruction: z
        .string()
        .min(1)
        .optional()
        .describe("Short follow-up instruction for the current browser session."),
      commands: z
        .array(browserCommandSchema)
        .optional()
        .describe("Structured browser commands like goto, click, typeFocused, back, forward, reload, or scroll."),
      close: z
        .boolean()
        .optional()
        .describe("Set true to close the browser session."),
    }),
    execute: async ({ browserSessionId, instruction, commands, close }) => {
      if (close === true) {
        const res = closeSession(browserSessionId);
        if (!res.ok) {
          return {
            ok: false,
            error: res.error ?? "failed_to_close_session",
            status: "failed",
            browserSessionId,
            sessionId: browserSessionId,
          };
        }

        return {
          ok: true,
          status: "closed",
          summary: "Browser session closed.",
          browserSessionId,
          sessionId: browserSessionId,
        };
      }

      const hasCommands = Array.isArray(commands) && commands.length > 0;
      const cmd = hasCommands
        ? JSON.stringify({ commands })
        : typeof instruction === "string" && instruction.trim()
          ? instruction.trim()
          : null;

      if (!cmd) {
        return {
          ok: false,
          error: "missing_instruction_or_commands",
          status: "failed",
          browserSessionId,
          sessionId: browserSessionId,
        };
      }

      const result = sendCommandToSession(browserSessionId, cmd);
      if (!result.ok) {
        return {
          ok: false,
          error: result.error ?? "failed_to_send_command",
          status: "failed",
          browserSessionId,
          sessionId: browserSessionId,
        };
      }

      const snapshot = buildSessionSnapshot(browserSessionId);
      if (snapshot) {
        return snapshot;
      }

      return {
        ok: true,
        status: "running",
        summary: "Command sent to browser session.",
        browserSessionId,
        sessionId: browserSessionId,
      };
    },
  });
}
