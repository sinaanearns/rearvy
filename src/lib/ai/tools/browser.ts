import { tool } from "ai";
import { z } from "zod";
import { spawn } from "child_process";
import type { ToolContext } from "../types";
import { isWebDeployment, isDesktop } from "@/lib/utils/env";
import { sanitizeAssistantText } from "@/lib/ai/sanitize";
import { inferQuickStartUrl } from "@/lib/ai/browser-navigation";

import { runBrowserAgent } from "@/lib/browser-use/runner";
import { runDemoBrowserAgent, getDemoBrowserMessage } from "@/lib/browser-use/demo-agent";

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
