import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import { createServerLogger } from "@/lib/server-logger";
import { assertPublicHttpUrl } from "./web";
import {
  firecrawlCreateInteractSession,
  firecrawlExecuteInSession,
  firecrawlScrapeUrl,
  firecrawlInteractOnScrape,
  firecrawlDeleteInteractSession,
  firecrawlStopScrapeSession,
  isFirecrawlConfigured,
} from "@/lib/firecrawl/client";

const log = createServerLogger("FirecrawlInteract");

/**
 * Firecrawl Interact tool — cloud-hosted browser automation.
 *
 * Two modes:
 *  - "session"  → Creates a standalone cloud browser session, executes code via Playwright,
 *                  returns liveViewUrl so the user can watch the browser live.
 *  - "scrape"   → Scrapes a URL, then sends a natural-language prompt to the AI agent
 *                  inside the scrape-bound browser session. Best for targeted page actions.
 */
export function firecrawlInteract(ctx: ToolContext) {
  void ctx;
  return tool({
    description:
      "Perform cloud browser automation using Firecrawl Interact. " +
      "Mode 'session' creates a live cloud browser you can drive with Playwright code and returns a liveViewUrl for the user to watch. " +
      "Mode 'scrape' scrapes a URL first then sends a natural-language prompt to the AI agent on that page. " +
      "Use for: clicking buttons, filling forms, navigating sites, extracting dynamic content.",
    inputSchema: z.object({
      mode: z
        .enum(["session", "scrape"])
        .describe(
          "'session' — standalone live browser driven by Playwright code. " +
          "'scrape' — scrape a URL then interact via natural-language prompt."
        ),
      url: z
        .string()
        .url()
        .optional()
        .describe("Starting URL for the browser session (required in both modes)."),
      code: z
        .string()
        .optional()
        .describe(
          "Playwright Python code to execute in the browser (mode='session'). " +
          "e.g. \"await page.goto('https://example.com')\\ntitle = await page.title()\\nprint(title)\""
        ),
      prompt: z
        .string()
        .optional()
        .describe(
          "Natural-language instruction for the AI agent (mode='scrape'). " +
          "e.g. 'Click the Sign Up button and fill the form with name John and email john@example.com'"
        ),
      language: z
        .enum(["python", "node", "bash"])
        .optional()
        .default("python")
        .describe("Code language for mode='session'. Default: python."),
      timeout: z
        .number()
        .int()
        .min(5)
        .max(300)
        .optional()
        .default(60)
        .describe("Execution timeout in seconds (5-300). Default: 60."),
      ttl: z
        .number()
        .int()
        .min(30)
        .max(3600)
        .optional()
        .default(600)
        .describe("Session TTL in seconds for mode='session'. Default: 600 (10 min)."),
      profileName: z
        .string()
        .optional()
        .describe(
          "Browser profile name for mode='session'. Sessions with the same name share cookies/localStorage. " +
          "Use to persist logins across browser task invocations."
        ),
      maxChars: z
        .number()
        .int()
        .min(100)
        .max(50000)
        .optional()
        .default(8000)
        .describe("Maximum characters to return in result."),
    }),
    execute: async ({ mode, url, code, prompt, language, timeout, ttl, profileName, maxChars }) => {
      if (!isFirecrawlConfigured()) {
        return {
          ok: false,
          error:
            "Firecrawl API key not configured. Add FIRECRAWL_API_KEY to your .env.local file and restart the server.",
        };
      }

      if (!url) {
        return { ok: false, error: "A URL is required for browser interaction." };
      }

      let publicUrl: string;
      try {
        publicUrl = assertPublicHttpUrl(url);
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }

      // -----------------------------------------------------------------------
      // Mode: session — standalone cloud browser driven with Playwright code
      // -----------------------------------------------------------------------
      if (mode === "session") {
        if (!code) {
          return {
            ok: false,
            error: "code is required when mode is 'session'.",
          };
        }

        log.info(`[FirecrawlInteract] Creating standalone session for: ${publicUrl}`);

        const session = await firecrawlCreateInteractSession({
          ttl: ttl ?? 600,
          activityTtl: 300,
          profileName: profileName,
        });

        if (!session.success || !session.id) {
          return {
            ok: false,
            error: session.error || "Failed to create Firecrawl browser session.",
          };
        }

        log.info(`[FirecrawlInteract] Session created: ${session.id}`);

        try {
          // First navigate to the target URL
          const navCode =
            language === "python"
              ? `await page.goto("${publicUrl}", wait_until="domcontentloaded")\nprint(await page.title())`
              : `await page.goto("${publicUrl}", { waitUntil: "domcontentloaded" });\nconsole.log(await page.title());`;

          await firecrawlExecuteInSession(session.id, navCode, { language, timeout: 30 });

          // Then execute the user's code
          const execResult = await firecrawlExecuteInSession(session.id, code, {
            language,
            timeout: timeout ?? 60,
          });

          let resultText = execResult.stdout || execResult.result || "";
          if (execResult.stderr) resultText += `\n[stderr]: ${execResult.stderr}`;
          const trimmed = resultText.length > (maxChars ?? 8000);
          if (trimmed) {
            resultText = resultText.substring(0, maxChars) + "\n\n[Result trimmed due to length]";
          }

          return {
            ok: true,
            result: {
              text: resultText,
              sessionId: session.id,
              liveViewUrl: session.liveViewUrl ?? null,
              interactiveLiveViewUrl: session.interactiveLiveViewUrl ?? null,
              exitCode: execResult.exitCode ?? 0,
              killed: execResult.killed ?? false,
              trimmed,
              method: "firecrawl-session",
            },
          };
        } catch (error) {
          log.error(`[FirecrawlInteract] Execution failed:`, error);
          // Clean up session on error
          await firecrawlDeleteInteractSession(session.id).catch(() => undefined);
          return {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }

      // -----------------------------------------------------------------------
      // Mode: scrape — scrape URL then prompt AI agent on that page
      // -----------------------------------------------------------------------
      if (!prompt) {
        return {
          ok: false,
          error: "prompt is required when mode is 'scrape'.",
        };
      }

      log.info(`[FirecrawlInteract] Scraping ${publicUrl} for interact session`);

      const scrapeResult = await firecrawlScrapeUrl(publicUrl, {
        formats: ["markdown", "screenshot"],
        timeout: 30,
      });

      if (!scrapeResult.success || !scrapeResult.id) {
        return {
          ok: false,
          error: scrapeResult.error || "Failed to scrape URL — no session ID returned.",
        };
      }

      const scrapeId = scrapeResult.id;
      log.info(`[FirecrawlInteract] Scrape job ID: ${scrapeId}, sending prompt`);

      try {
        const interactResult = await firecrawlInteractOnScrape(scrapeId, prompt, {
          timeout: timeout ?? 60,
        });

        let resultText = interactResult.output || interactResult.result || interactResult.stdout || "";
        const trimmed = resultText.length > (maxChars ?? 8000);
        if (trimmed) {
          resultText = resultText.substring(0, maxChars) + "\n\n[Result trimmed due to length]";
        }

        // Stop the scrape browser session after we're done
        await firecrawlStopScrapeSession(scrapeId).catch(() => undefined);

        return {
          ok: true,
          result: {
            text: resultText,
            sessionId: scrapeId,
            liveViewUrl: interactResult.liveViewUrl ?? null,
            interactiveLiveViewUrl: interactResult.interactiveLiveViewUrl ?? null,
            exitCode: interactResult.exitCode ?? 0,
            killed: interactResult.killed ?? false,
            trimmed,
            method: "firecrawl-scrape-interact",
            pageMarkdown: scrapeResult.data?.markdown?.substring(0, 2000) ?? null,
            screenshot: scrapeResult.data?.screenshot ?? null,
          },
        };
      } catch (error) {
        log.error(`[FirecrawlInteract] Prompt interaction failed:`, error);
        await firecrawlStopScrapeSession(scrapeId).catch(() => undefined);
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
}

