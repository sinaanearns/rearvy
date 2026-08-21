import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";


export function runBrowserTask(ctx: ToolContext) {
  void ctx;
  return tool({
    description:
      "Run an autonomous browser task using Rearvy's Firecrawl cloud browser or local browser runtime. " +
      "Firecrawl is the default and provides a live browser session with a view URL. " +
      "Best for opening sites directly, exploring sites, scraping data, or bounded multi-step workflows. " +
      "Returns a liveViewUrl so the user can watch and interact with the browser in real time. " +
      "When using Firecrawl, Rearvy automatically drives the browser step-by-step using AI to achieve the goal.",
    inputSchema: z.object({
      task: z
        .string()
        .describe(
          "The precise description of the browser task to perform. " +
          "CRITICAL: Explicitly specify whether the goal is 'Sign in to [service]' (Log in) or 'Sign up for [service]' (Create new account). Do NOT confuse sign in with sign up."
        ),
      connectionMethod: z
        .enum(["auto", "cdp-direct", "extension-relay", "managed-runner", "cloud-browser", "firecrawl"])
        .default("firecrawl")
        .describe(
          "How to connect to a browser. Use 'firecrawl' for Firecrawl Cloud Browser, which is the default."
        ),
      strategy: z
        .enum(["goal-seeking", "open-only"])
        .default("goal-seeking")
        .describe(
          "Use goal-seeking for multi-step workflows (sign in, fill forms, navigate). " +
          "Use open-only only for simple page opens with no interaction needed."
        ),
      dedupeKey: z
        .string()
        .optional()
        .describe("Stable key for this browser request. Reusing a key must reuse the same session."),
      stealthMode: z
        .boolean()
        .optional()
        .describe(
          "When true, use the CloakBrowser stealth Chromium binary which applies source-level C++ patches to bypass bot-detection systems. Only applies to local managed-runner sessions."
        ),
      proxy: z
        .string()
        .optional()
        .describe(
          "Optional HTTP or SOCKS5 proxy URL to route all browser traffic through. Only applies to local managed-runner sessions."
        ),
    }),
    execute: async ({ task, connectionMethod, strategy, dedupeKey, stealthMode, proxy }) => {
      // Normalize task goal intent so Sign In / Log In is never confused with Sign Up / Register
      let normalizedTask = task.trim();
      const lowerTask = normalizedTask.toLowerCase();
      if (
        (lowerTask.includes("signin") || lowerTask.includes("sign in") || lowerTask.includes("login") || lowerTask.includes("log in")) &&
        !lowerTask.includes("signup") &&
        !lowerTask.includes("sign up") &&
        !lowerTask.includes("register")
      ) {
        normalizedTask = normalizedTask.replace(/\bsignin\b/i, "sign in").replace(/\blogin\b/i, "log in");
      }

      const { createUnifiedBrowserSession } = await import("@/lib/browser-use/unifiedSessionManager");
      const result = await createUnifiedBrowserSession(normalizedTask, ctx.userId, {
        connectionMethod,
        strategy,
        dedupeKey,
        stealthMode,
        proxy,
      });
      if (!result.ok) {
        return { ok: false, error: result.error };
      }

      // Extract live view URLs from session data (Firecrawl sessions include these)
      const sessionData = result.session as Record<string, unknown> | undefined;
      const liveViewUrl = typeof sessionData?.liveViewUrl === "string" ? sessionData.liveViewUrl : null;
      const interactiveLiveViewUrl =
        typeof sessionData?.interactiveLiveViewUrl === "string" ? sessionData.interactiveLiveViewUrl : null;

      let actionLog: unknown[] | undefined;
      try {
        const { getUnifiedBrowserSession } = await import("@/lib/browser-use/unifiedSessionManager");
        const sessionLookup = await getUnifiedBrowserSession({
          sessionId: result.id,
          userId: ctx.userId,
        });
        if (sessionLookup.ok) {
          const persisted = sessionLookup.session as Record<string, unknown> | undefined;
          if (Array.isArray(persisted?.actionLog)) {
            actionLog = persisted.actionLog as unknown[];
          }
        }
      } catch {
        // Non-fatal: action log can still be loaded by session viewer polling.
      }

      const sessionId = result.id;
      const isFirecrawlSession = sessionId.startsWith("fc_") || result.connectionMethod === "firecrawl";

      // For Firecrawl sessions using goal-seeking strategy, automatically start the AI drive loop.
      // The drive loop runs in the background — we return immediately with the session + live view URL
      // so the user can start watching the browser, while Rearvy drives it step-by-step.
      if (isFirecrawlSession && strategy !== "open-only" && !result.reused) {
        // Fire-and-forget: launch the drive loop asynchronously
        import("@/lib/browser-use/browserDriveEngine")
          .then(({ driveBrowserSession }) =>
            driveBrowserSession(sessionId, normalizedTask, ctx.userId, {
              maxSteps: 15,
              stepTimeoutSeconds: 60,
              isDesktopApp: ctx.isDesktopApp ?? false,
            })
          )
          .catch((err: unknown) => {
            // Non-fatal: session already persisted, user can see the browser
            console.warn("[runBrowserTask] AI drive loop error (non-fatal):", err);
          });
      }

      return {
        ok: true,
        message: result.reused
          ? "Browser session already running."
          : isFirecrawlSession && strategy !== "open-only"
            ? "Browser session started. Execution log is now tracking each browser step."
            : "Browser session started.",
        browserSessionId: sessionId,
        status: result.status || "initializing",
        connectionMethod: result.connectionMethod,
        strategy,
        reused: result.reused === true,
        summary: result.summary,
        currentUrl: result.currentUrl,
        title: result.title,
        task,
        stealthMode: stealthMode === true,
        liveViewUrl,
        interactiveLiveViewUrl,
        aiDriving: isFirecrawlSession && strategy !== "open-only" && !result.reused,
        actionLog,
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
