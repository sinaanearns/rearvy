import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import { createSession, sendCommandToSession, closeSession, getSession } from "@/lib/browser-use/sessionManager";

export function runBrowserTask(ctx: ToolContext) {
  void ctx;
  return tool({
    description: "Run an autonomous browser task using the browser-use framework. This will open a new browser session and perform the requested task. Best for opening sites directly, exploring sites, or multi-step workflows.",
    inputSchema: z.object({
      task: z.string().describe("The description of the browser task to perform."),
    }),
    execute: async ({ task }) => {
      const result = createSession(task);
      if (!result.ok) {
        return { ok: false, error: result.error };
      }

      return {
        ok: true,
        message: "Browser session started.",
        browserSessionId: result.id,
        status: "initializing",
        task,
      };
    },
  });
}

export function controlBrowserSession(ctx: ToolContext) {
  void ctx;
  return tool({
    description: "Send a command to an active browser session. Use this to continue a conversation or provide additional instructions to the agent.",
    inputSchema: z.object({
      sessionId: z.string().describe("The ID of the active browser session."),
      command: z.string().describe("The command or instruction to send to the session."),
    }),
    execute: async ({ sessionId, command }) => {
      const result = sendCommandToSession(sessionId, command);
      if (!result.ok) {
        return { ok: false, error: result.error };
      }

      return {
        ok: true,
        message: "Command sent to browser session.",
        browserSessionId: sessionId,
        status: "processing_command",
      };
    },
  });
}

export function stopBrowserSessionTool(ctx: ToolContext) {
  void ctx;
  return tool({
    description: "Stop and close an active browser session.",
    inputSchema: z.object({
      sessionId: z.string().describe("The ID of the browser session to stop."),
    }),
    execute: async ({ sessionId }) => {
      const result = closeSession(sessionId);
      if (!result.ok) {
        return { ok: false, error: result.error };
      }

      return {
        ok: true,
        message: "Browser session closed.",
        browserSessionId: sessionId,
        status: "closed",
      };
    },
  });
}
