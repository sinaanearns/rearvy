import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";


export function runBrowserTask(ctx: ToolContext) {
  void ctx;
  return tool({
    description:
      "Run an autonomous browser task using Rearvy's browser runtime. On Vercel this can start a Browserbase cloud browser; in desktop/dev it uses the local browser-use runner. Best for opening sites directly, exploring sites, scraping data, or bounded multi-step workflows. Use stealthMode=true for sites that block bots (Cloudflare, reCAPTCHA, etc.).",
    inputSchema: z.object({
      task: z.string().describe("The description of the browser task to perform."),
      connectionMethod: z
        .enum(["auto", "cdp-direct", "extension-relay", "managed-runner", "cloud-browser"])
        .default("auto")
        .describe(
          "How to connect to a browser. Use cloud-browser for the hosted cloud computer, and auto unless the user selected a method."
        ),
      strategy: z
        .enum(["goal-seeking", "open-only"])
        .default("goal-seeking")
        .describe("Use goal-seeking for multi-step discovery; use open-only only for simple page opens."),
      dedupeKey: z
        .string()
        .optional()
        .describe("Stable key for this browser request. Reusing a key must reuse the same session."),
      stealthMode: z
        .boolean()
        .optional()
        .describe(
          "When true, use the CloakBrowser stealth Chromium binary which applies source-level C++ patches to bypass bot-detection systems (Cloudflare Turnstile, reCAPTCHA v3, FingerprintJS). Use for scraping protected sites. Requires cloakbrowser to be installed in the local Python environment."
        ),
      proxy: z
        .string()
        .optional()
        .describe(
          "Optional HTTP or SOCKS5 proxy URL to route all browser traffic through, e.g. http://user:pass@host:8080 or socks5://host:1080. Combine with stealthMode for fully anonymous scraping."
        ),
    }),
    execute: async ({ task, connectionMethod, strategy, dedupeKey, stealthMode, proxy }) => {
      const { createUnifiedBrowserSession } = await import("@/lib/browser-use/unifiedSessionManager");
      const result = await createUnifiedBrowserSession(task, ctx.userId, {
        connectionMethod,
        strategy,
        dedupeKey,
        stealthMode,
        proxy,
      });
      if (!result.ok) {
        return { ok: false, error: result.error };
      }

      return {
        ok: true,
        message: result.reused
          ? "Browser session already running."
          : "Browser session started.",
        browserSessionId: result.id,
        status: result.status || "initializing",
        connectionMethod: result.connectionMethod,
        strategy,
        reused: result.reused === true,
        summary: result.summary,
        currentUrl: result.currentUrl,
        title: result.title,
        task,
        stealthMode: stealthMode === true,
      };
    },
  });
}

export function controlBrowserSession(ctx: ToolContext) {
  void ctx;
  return tool({
    description:
      "Send a command to an active browser session. Use this to continue a conversation or provide additional instructions to the agent.",
    inputSchema: z.object({
      sessionId: z.string().describe("The ID of the active browser session."),
      command: z.string().describe("The command or instruction to send to the session."),
    }),
    execute: async ({ sessionId, command }) => {
      const { sendCommandToUnifiedBrowserSession } = await import(
        "@/lib/browser-use/unifiedSessionManager"
      );
      const result = await sendCommandToUnifiedBrowserSession({
        sessionId,
        userId: ctx.userId,
        command,
      });
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
      const { closeUnifiedBrowserSession } = await import("@/lib/browser-use/unifiedSessionManager");
      const result = await closeUnifiedBrowserSession({
        sessionId,
        userId: ctx.userId,
      });
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
