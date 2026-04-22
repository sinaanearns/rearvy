import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import {
  resolveBrowserCredentialByLabel,
  searchBrowserCredentials,
  touchBrowserCredentialUse,
} from "@/lib/browser-use/credentials";
import {
  inferQuickStartUrl,
  normalizeBrowserService,
} from "@/lib/ai/browser-navigation";
import { ensureLiveBrowserFrameServer } from "@/lib/live-browser/frame-server";
import { serializeLiveBrowserSession } from "@/lib/live-browser/presenter";
import {
  browserCommandSchema,
  type BrowserCommandInput,
} from "@/lib/live-browser/shared";
import { getLiveBrowserSessionManager } from "@/lib/live-browser/session-manager";
import { planBrowserSessionFromTask } from "@/lib/live-browser/task-planner";

const BROWSER_AUTH_PATTERN =
  /\b(create|sign up|signup|register|log in|login|sign in|upload|publish|connect|link|channel|account)\b/i;
const SERVICE_AUTH_HINTS: Record<string, RegExp> = {
  google:
    /\b(gmail|drive|docs|sheets|slides|calendar|analytics|search console|ads|merchant center|business profile|workspace|admin|console|google account|account settings)\b/i,
  youtube:
    /\b(channel|studio|upload|publish|monetization|brand account|creator studio|youtube studio|comment|account settings)\b/i,
  instagram:
    /\b(profile|post|publish|story|reel|dm|message|comment|settings|business account|creator account)\b/i,
  facebook:
    /\b(page|profile|post|publish|message|messenger|business manager|ads manager|settings|group)\b/i,
  x:
    /\b(profile|tweet|post|publish|dm|message|settings|ads)\b/i,
  twitter:
    /\b(profile|tweet|post|publish|dm|message|settings|ads)\b/i,
};

type BrowserCredentialSummary = {
  label: string;
  service: string;
  loginMask: string;
  lastUsedAt: string | null;
};

function inferLikelyService(task: string, explicitService?: string | null) {
  const normalizedExplicit = normalizeBrowserService(explicitService);
  if (normalizedExplicit) {
    return normalizedExplicit;
  }

  const lower = task.toLowerCase();
  if (lower.includes("youtube") || lower.includes("google account")) {
    return "youtube";
  }

  if (lower.includes("instagram")) {
    return "instagram";
  }

  if (lower.includes("facebook")) {
    return "facebook";
  }

  if (lower.includes("gmail") || lower.includes("google")) {
    return "google";
  }

  return null;
}

function isSimpleOpenTask(task: string) {
  return /^(open|go to|visit|navigate to)\s+/i.test(task.trim());
}

function taskNeedsAuthentication(task: string, service?: string | null) {
  if (BROWSER_AUTH_PATTERN.test(task)) {
    return true;
  }

  const normalizedService = normalizeBrowserService(service);
  if (!normalizedService) {
    return false;
  }

  return SERVICE_AUTH_HINTS[normalizedService]?.test(task) ?? false;
}

function getSetupQuestions(task: string, service?: string | null) {
  const questions: string[] = [];
  const lowerTask = task.toLowerCase();
  const normalizedService = normalizeBrowserService(service);

  if (
    (normalizedService === "youtube" || lowerTask.includes("youtube")) &&
    lowerTask.includes("channel")
  ) {
    questions.push("What should the YouTube channel name be?");
    questions.push("What handle or @username should I try if it is available?");
    questions.push("What niche, language, or short description should I use?");
  }

  if (
    lowerTask.includes("create account") ||
    lowerTask.includes("sign up") ||
    lowerTask.includes("register")
  ) {
    questions.push("What display name or business name should I use?");
  }

  return [...new Set(questions)];
}

function createContinuePrompt(task: string, credentialLabel: string) {
  return `Run the browser task "${task}" now using saved browser credential label "${credentialLabel}".`;
}

function extractCredentialLabelFromTask(task: string) {
  const quotedMatch = task.match(
    /saved browser credential label\s+["']([^"']+)["']/i
  );
  if (quotedMatch && quotedMatch[1]) {
    return quotedMatch[1].trim();
  }

  const unquotedMatch = task.match(
    /saved browser credential label\s+([^,.\n]+)/i
  );
  if (unquotedMatch && unquotedMatch[1]) {
    return unquotedMatch[1].trim();
  }

  return "";
}

function toCredentialSummary(
  items: Awaited<ReturnType<typeof searchBrowserCredentials>>
): BrowserCredentialSummary[] {
  return items.map((item) => ({
    label: item.label,
    service: item.service,
    loginMask: item.loginMask,
    lastUsedAt: item.lastUsedAt,
  }));
}

export function searchBrowserCredentialsTool(ctx: ToolContext) {
  return tool({
    description:
      "Look up securely stored browser credentials by service or label. Use this only when the user explicitly asks about saved credentials or when a browser task actually needs a credential choice. Do not call this just to open a public homepage or public site.",
    inputSchema: z.object({
      query: z
        .string()
        .optional()
        .default("")
        .describe("Optional label or keyword to search"),
      service: z
        .string()
        .optional()
        .describe("Optional service like youtube, google, instagram, shopify"),
      limit: z.number().int().min(1).max(8).optional().default(5),
    }),
    execute: async ({ query, service, limit }) => {
      const matches = await searchBrowserCredentials({
        adminDb: ctx.adminDb,
        userId: ctx.userId,
        query,
        service,
        projectId: ctx.projectId,
        limit,
      });

      return {
        ok: true,
        action: "searchCredentials",
        status: "ready",
        message:
          matches.length > 0
            ? `Found ${matches.length} saved browser credential set${
                matches.length === 1 ? "" : "s"
              }.`
            : "No saved browser credentials matched that search.",
        credentials: toCredentialSummary(matches),
        suggestedReplies: matches.map(
          (item) =>
            `Run the browser task now using saved browser credential label "${item.label}".`
        ),
      };
    },
  });
}

export function runBrowserTaskTool(ctx: ToolContext) {
  return tool({
    description:
      "Start a real Playwright-controlled browser session for live web work. Use this first for opening a site or kicking off a browser task, then use controlBrowserSession with structured commands to continue clicking, typing, scrolling, or navigating inside that same live session.",
    inputSchema: z.object({
      task: z
        .string()
        .min(8)
        .describe("The concrete website task to perform in the browser"),
      service: z
        .string()
        .optional()
        .describe("Optional target service like youtube, google, instagram"),
      startUrl: z
        .string()
        .url()
        .optional()
        .describe("Optional page to open first"),
      credentialLabel: z
        .string()
        .optional()
        .describe(
          "Optional label for a previously saved browser credential set to reuse"
        ),
      headless: z
        .boolean()
        .optional()
        .default(true)
        .describe("Run the browser headlessly unless debugging is needed"),
    }),
    execute: async ({ task, service, startUrl, credentialLabel, headless }) => {
      const normalizedTask = task.trim();
      const inferredService = inferLikelyService(normalizedTask, service);
      const simpleOpenTask = isSimpleOpenTask(normalizedTask);
      const inferredStartUrl = inferQuickStartUrl(normalizedTask, inferredService);
      const effectiveStartUrl = startUrl ?? inferredStartUrl;
      const authRequired = taskNeedsAuthentication(normalizedTask, inferredService);
      const setupQuestions = getSetupQuestions(normalizedTask, inferredService);
      const hintedCredentialLabel =
        credentialLabel?.trim() || extractCredentialLabelFromTask(normalizedTask);

      const availableCredentials = await searchBrowserCredentials({
        adminDb: ctx.adminDb,
        userId: ctx.userId,
        service: inferredService,
        projectId: ctx.projectId,
        limit: 5,
      });
      let effectiveCredentialLabel = hintedCredentialLabel;

      if (authRequired && !effectiveCredentialLabel && availableCredentials.length === 1) {
        effectiveCredentialLabel = availableCredentials[0]?.label ?? "";
      }

      if (authRequired && !effectiveCredentialLabel) {
        return {
          ok: true,
          action: "runTask",
          status: "needs_input",
          service: inferredService,
          task: normalizedTask,
          message:
            availableCredentials.length > 0
              ? "This browser task looks like it needs a login. I found saved credentials you can reuse or you can add a new secure credential below."
              : "This browser task looks like it needs a login before I can continue. Add a secure browser credential below, then continue the task.",
          followUpQuestions: [
            ...setupQuestions,
            availableCredentials.length > 0
              ? "Should I use one of your saved credentials, or do you want to add a new one securely?"
              : "Which login should I use for this task?",
          ],
          availableCredentials: toCredentialSummary(availableCredentials),
          requiresCredentialInput: true,
          credentialInput: {
            service: inferredService ?? "website",
            labelSuggestion:
              inferredService && inferredService !== "website"
                ? `${inferredService} login`
                : "browser login",
          },
          suggestedReplies: availableCredentials.map((item) =>
            createContinuePrompt(normalizedTask, item.label)
          ),
        };
      }

      let resolvedCredential:
        | Awaited<ReturnType<typeof resolveBrowserCredentialByLabel>>
        | null = null;

      if (effectiveCredentialLabel) {
        resolvedCredential = await resolveBrowserCredentialByLabel({
          adminDb: ctx.adminDb,
          userId: ctx.userId,
          label: effectiveCredentialLabel,
          service: inferredService,
          projectId: ctx.projectId,
        });

        if (!resolvedCredential) {
          return {
            ok: false,
            action: "runTask",
            status: "needs_input",
            service: inferredService,
            task: normalizedTask,
            message: `I could not find a saved browser credential labeled "${effectiveCredentialLabel}".`,
            followUpQuestions: [
              "Do you want to use a different saved credential or add a new secure one?",
            ],
            availableCredentials: toCredentialSummary(availableCredentials),
            requiresCredentialInput: true,
            credentialInput: {
              service: inferredService ?? "website",
              labelSuggestion:
                inferredService && inferredService !== "website"
                  ? `${inferredService} login`
                  : "browser login",
            },
            suggestedReplies: availableCredentials.map((item) =>
              createContinuePrompt(normalizedTask, item.label)
            ),
          };
        }
      }

      try {
        ensureLiveBrowserFrameServer();
        const manager = getLiveBrowserSessionManager();
        const plan = planBrowserSessionFromTask({
          task: normalizedTask,
          startUrl: effectiveStartUrl ?? null,
        });

        let session = await manager.createSession({
          userId: ctx.userId,
          headless,
          initialUrl: null,
        });

        if (plan.commands.length > 0) {
          const execution = await manager.executeCommands(
            ctx.userId,
            session.sessionId,
            plan.commands
          );
          session = execution.session;
        }

        if (resolvedCredential?.id) {
          void touchBrowserCredentialUse({
            adminDb: ctx.adminDb,
            credentialId: resolvedCredential.id,
          }).catch((error) => {
            console.warn("Failed to update browser credential usage:", error);
          });
        }

        return {
          ok: true,
          action: "runTask",
          status: simpleOpenTask || plan.commands.length > 0 ? "completed" : "ready",
          service: inferredService,
          task: normalizedTask,
          message: plan.summary,
          summary: plan.summary,
          blocker: null,
          followUpQuestions: [],
          createdEntities: [],
          notes: [
            resolvedCredential
              ? `Saved credential "${resolvedCredential.label}" is available for follow-up browser steps.`
              : null,
            "Live Playwright session is streaming now.",
            "Use controlBrowserSession for structured goto, click, type, or scroll commands.",
          ].filter(Boolean),
          errors: [],
          usedCredentialLabel: resolvedCredential?.label ?? null,
          availableCredentials: toCredentialSummary(availableCredentials),
          requiresCredentialInput: false,
          credentialInput: null,
          suggestedReplies: [],
          ...serializeLiveBrowserSession(session),
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to start the browser session.";
        const launchHint = /executable doesn't exist|browser has been closed|Failed to launch/i.test(
          errorMessage
        )
          ? "Install Chromium with `npx playwright install chromium` on the server, then retry."
          : errorMessage;

        return {
          ok: false,
          action: "runTask",
          status: "unavailable",
          service: inferredService,
          task: normalizedTask,
          message: launchHint,
          summary: launchHint,
          blocker: null,
          followUpQuestions: setupQuestions,
          createdEntities: [],
          finalUrl: effectiveStartUrl ?? null,
          notes: [],
          errors: [errorMessage],
          usedCredentialLabel: resolvedCredential?.label ?? null,
          availableCredentials: toCredentialSummary(availableCredentials),
          requiresCredentialInput: false,
          credentialInput: null,
          suggestedReplies: [],
        };
      }
    },
  });
}

export function controlBrowserSessionTool(ctx: ToolContext) {
  return tool({
    description:
      "Send structured commands to an existing live Playwright browser session. Use this after runBrowserTask to click, type, scroll, or navigate inside the already-open browser.",
    inputSchema: z
      .object({
        sessionId: z.string().min(1).describe("The live browser session ID"),
        command: browserCommandSchema.optional(),
        commands: z.array(browserCommandSchema).min(1).max(12).optional(),
      })
      .refine((value) => Boolean(value.command || value.commands?.length), {
        message: "Provide one command or a commands array.",
        path: ["command"],
      }),
    execute: async ({ sessionId, command, commands }) => {
      try {
        ensureLiveBrowserFrameServer();
        const result = await getLiveBrowserSessionManager().executeCommands(
          ctx.userId,
          sessionId,
          commands ?? [command as BrowserCommandInput]
        );

        return {
          ok: result.ok,
          action: "controlSession",
          status: result.session.status,
          message: result.summary,
          summary: result.summary,
          notes: [
            "Live Playwright session updated.",
          ],
          errors: result.error ? [result.error] : [],
          ...serializeLiveBrowserSession(result.session),
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to control the browser session.";
        const sessionMissing = /browser session not found/i.test(errorMessage);
        const message = sessionMissing
          ? "This live browser session is no longer available. Start a new browser task to reopen it."
          : errorMessage;

        return {
          ok: false,
          action: "controlSession",
          status: sessionMissing ? "unavailable" : "failed",
          message,
          summary: message,
          finalUrl: null,
          notes: sessionMissing
            ? [
                "The previous live browser session ended or the server restarted.",
              ]
            : [],
          errors: sessionMissing ? [] : [errorMessage],
          suggestedReplies: sessionMissing
            ? ["Open the website again in a new browser session."]
            : [],
        };
      }
    },
  });
}
