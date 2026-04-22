import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import {
  resolveBrowserCredentialByLabel,
  searchBrowserCredentials,
  touchBrowserCredentialUse,
} from "@/lib/browser-use/credentials";
import {
  isBrowserUseConfigured,
  runBrowserUseTask,
} from "@/lib/browser-use/runner";

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

function normalizeService(service: string | null | undefined) {
  return service ? service.trim().toLowerCase() : null;
}

function inferLikelyService(task: string, explicitService?: string | null) {
  const normalizedExplicit = normalizeService(explicitService);
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

function isQuickPublicOpenTask(params: {
  task: string;
  startUrl: string | null;
  authRequired: boolean;
  hasCredentialLabel: boolean;
}) {
  const { task, startUrl, authRequired, hasCredentialLabel } = params;
  if (!startUrl || authRequired || hasCredentialLabel) {
    return false;
  }

  if (!isSimpleOpenTask(task)) {
    return false;
  }

  const normalizedTask = task.trim().toLowerCase();
  if (
    /\b(log in|login|sign in|sign up|signup|register|create|fill|submit|upload|publish|configure|checkout|buy|book|apply|inside the browser workflow|continue in chat)\b/i.test(
      normalizedTask
    )
  ) {
    return false;
  }

  if (normalizedTask.includes(" and ")) {
    return false;
  }

  return true;
}

function describeQuickOpenTarget(service: string | null, startUrl: string) {
  const normalizedService = normalizeService(service);
  if (normalizedService === "google") {
    return "Google";
  }
  if (normalizedService === "youtube") {
    return "YouTube";
  }
  if (normalizedService === "instagram") {
    return "Instagram";
  }
  if (normalizedService === "facebook") {
    return "Facebook";
  }

  try {
    const hostname = new URL(startUrl).hostname.replace(/^www\./, "");
    return hostname || "the page";
  } catch {
    return "the page";
  }
}

function inferQuickStartUrl(task: string, service?: string | null) {
  const normalizedService = normalizeService(service);
  if (normalizedService) {
    if (normalizedService === "google") {
      return "https://www.google.com";
    }
    if (normalizedService === "youtube") {
      return "https://www.youtube.com";
    }
    if (normalizedService === "instagram") {
      return "https://www.instagram.com";
    }
    if (normalizedService === "facebook") {
      return "https://www.facebook.com";
    }
  }

  const lowerTask = task.toLowerCase();
  if (lowerTask.includes("google")) {
    return "https://www.google.com";
  }
  if (lowerTask.includes("youtube")) {
    return "https://www.youtube.com";
  }
  if (lowerTask.includes("instagram")) {
    return "https://www.instagram.com";
  }
  if (lowerTask.includes("facebook")) {
    return "https://www.facebook.com";
  }

  const domainMatch = task.match(/\b((?:[a-z0-9-]+\.)+[a-z]{2,})(?:\/[^\s]*)?/i);
  if (domainMatch?.[1]) {
    return `https://${domainMatch[1]}`;
  }

  return null;
}

function taskNeedsAuthentication(task: string, service?: string | null) {
  if (BROWSER_AUTH_PATTERN.test(task)) {
    return true;
  }

  const normalizedService = normalizeService(service);
  if (!normalizedService) {
    return false;
  }

  return SERVICE_AUTH_HINTS[normalizedService]?.test(task) ?? false;
}

function getSetupQuestions(task: string, service?: string | null) {
  const questions: string[] = [];
  const lowerTask = task.toLowerCase();
  const normalizedService = normalizeService(service);

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

function shouldUseCloudBrowser() {
  const value = process.env.BROWSER_USE_USE_CLOUD_BROWSER?.trim().toLowerCase();
  if (!value) {
    return false;
  }

  return ["1", "true", "yes", "on"].includes(value);
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
      "Use Browser Use to perform a real browser task on the web, such as opening sites, filling forms, creating accounts, setting up channels, or completing website workflows. Prefer this for actual browsing work. It already checks saved credentials and should not ask for credentials just to open a public homepage.",
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
      maxSteps: z.number().int().min(5).max(80).optional().default(30),
      headless: z
        .boolean()
        .optional()
        .default(true)
        .describe("Run the browser headlessly unless debugging is needed"),
    }),
    execute: async ({ task, service, startUrl, credentialLabel, maxSteps, headless }) => {
      const normalizedTask = task.trim();
      const inferredService = inferLikelyService(normalizedTask, service);
      const simpleOpenTask = isSimpleOpenTask(normalizedTask);
      const inferredStartUrl = inferQuickStartUrl(normalizedTask, inferredService);
      const effectiveStartUrl = startUrl ?? inferredStartUrl;
      const effectiveMaxSteps = simpleOpenTask ? Math.min(maxSteps, 8) : maxSteps;
      const authRequired = taskNeedsAuthentication(normalizedTask, inferredService);
      const setupQuestions = getSetupQuestions(normalizedTask, inferredService);
      const hintedCredentialLabel =
        credentialLabel?.trim() || extractCredentialLabelFromTask(normalizedTask);

      if (
        isQuickPublicOpenTask({
          task: normalizedTask,
          startUrl: effectiveStartUrl ?? null,
          authRequired,
          hasCredentialLabel: Boolean(hintedCredentialLabel),
        })
      ) {
        const destinationLabel = describeQuickOpenTarget(
          inferredService,
          effectiveStartUrl!
        );

        return {
          ok: true,
          action: "runTask",
          status: "completed",
          service: inferredService,
          task: normalizedTask,
          message: `${destinationLabel} is ready.`,
          summary: `${destinationLabel} is ready.`,
          blocker: null,
          followUpQuestions: [],
          createdEntities: [],
          finalUrl: effectiveStartUrl,
          notes: [
            "Quick-open shortcut used for a public page, so full browser automation was skipped for a faster response.",
          ],
          errors: [],
          usedCredentialLabel: null,
          availableCredentials: [],
          requiresCredentialInput: false,
          credentialInput: null,
          suggestedReplies: [],
        };
      }

      const availableCredentials = await searchBrowserCredentials({
        adminDb: ctx.adminDb,
        userId: ctx.userId,
        service: inferredService,
        projectId: ctx.projectId,
        limit: 5,
      });
      let effectiveCredentialLabel = hintedCredentialLabel;

      if (!isBrowserUseConfigured()) {
        return {
          ok: false,
          action: "runTask",
          status: "unavailable",
          service: inferredService,
          task: normalizedTask,
          message:
            "Browser automation is not configured yet. Add a supported Browser Use LLM provider on the server, such as Gamma, AI_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY, ANTHROPIC_API_KEY, GROQ_API_KEY, or BROWSER_USE_API_KEY.",
          followUpQuestions: [],
          availableCredentials: toCredentialSummary(availableCredentials),
        };
      }

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

      const browserResult = await runBrowserUseTask({
        task: normalizedTask,
        service: inferredService,
        startUrl: effectiveStartUrl ?? null,
        credential: resolvedCredential
          ? {
              label: resolvedCredential.label,
              login: resolvedCredential.login,
              password: resolvedCredential.password,
            }
          : null,
        llmModel: ctx.chatProviderModel ?? null,
        maxSteps: effectiveMaxSteps,
        headless,
        useCloudBrowser: shouldUseCloudBrowser(),
      });

      if (resolvedCredential?.id) {
        void touchBrowserCredentialUse({
          adminDb: ctx.adminDb,
          credentialId: resolvedCredential.id,
        }).catch((error) => {
          console.warn("Failed to update browser credential usage:", error);
        });
      }

      const credentialBlocked =
        browserResult.status === "needs_input" ||
        browserResult.status === "blocked"
          ? /login|sign in|password|credential|verification|email/i.test(
              [browserResult.summary, browserResult.blocker, ...(browserResult.errors ?? [])]
                .filter(Boolean)
                .join(" ")
            )
          : false;

      return {
        ok: browserResult.ok,
        action: "runTask",
        status: browserResult.status,
        service: inferredService,
        task: normalizedTask,
        message: browserResult.summary,
        summary: browserResult.summary,
        blocker: browserResult.blocker ?? null,
        followUpQuestions:
          browserResult.followUpQuestions && browserResult.followUpQuestions.length > 0
            ? browserResult.followUpQuestions
            : browserResult.status === "needs_input"
              ? setupQuestions
              : [],
        createdEntities: browserResult.createdEntities ?? [],
        finalUrl: browserResult.finalUrl ?? null,
        notes: [
          ...(browserResult.notes ?? []),
          ...(simpleOpenTask && effectiveStartUrl
            ? [
                `Quick navigation mode used for simple open-page task (${effectiveMaxSteps} steps max).`,
              ]
            : []),
        ],
        errors: browserResult.errors ?? [],
        usedCredentialLabel: resolvedCredential?.label ?? null,
        availableCredentials: toCredentialSummary(availableCredentials),
        requiresCredentialInput: credentialBlocked,
        credentialInput: credentialBlocked
          ? {
              service: inferredService ?? "website",
              labelSuggestion:
                inferredService && inferredService !== "website"
                  ? `${inferredService} login`
                  : "browser login",
            }
          : null,
        suggestedReplies:
          credentialBlocked && availableCredentials.length > 0
            ? availableCredentials.map((item) =>
                createContinuePrompt(normalizedTask, item.label)
              )
            : [],
      };
    },
  });
}
