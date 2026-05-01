import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import { isWebDeployment, isDesktop } from "@/lib/utils/env";
import { sanitizeAssistantText } from "@/lib/ai/sanitize";

import { runBrowserAgent } from "@/lib/browser-use/runner";

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
      // Security check: Only allow in desktop environment for now
      if (isWebDeployment() && !isDesktop() && !ctx.isDesktopApp) {
        return {
          ok: false,
          status: "unavailable",
          message: "Browser automation is only available in the Rearvy Desktop App. Please download the app to use this feature.",
        };
      }

      try {
        const result = await runBrowserAgent(task);
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
        return {
          ok: false,
          status: "failed",
          message: error instanceof Error ? error.message : "An unknown error occurred during browser automation.",
        };
      }
    },
  });
}
