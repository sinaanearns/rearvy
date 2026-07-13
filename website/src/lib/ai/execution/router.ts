import { z } from "zod";
import { resolveModelForChat } from "@/lib/ai/model-router";
import { generateObject } from "ai";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("Execution:Router");

export const EXECUTION_INTENT_CATEGORIES = [
  "browser",
  "chat",
  "code",
  "desktop",
  "email",
  "file",
  "memory",
  "media",
  "research",
  "terminal",
  "trading",
  "automation",
  "calendar",
  "knowledge",
  "integration",
] as const;

export type ExecutionIntentCategory = (typeof EXECUTION_INTENT_CATEGORIES)[number];

export const ExecutionIntentSchema = z.object({
  category: z.enum(EXECUTION_INTENT_CATEGORIES),
  action: z.string().min(1).max(120),
  parameters: z.record(z.string(), z.unknown()).default({}),
  confidence: z.number().min(0).max(1).default(0.5),
  requiresMultiStep: z.boolean().default(false),
  sensitivity: z.enum(["safe", "moderate", "high"]).default("safe"),
});

export type ExecutionIntent = z.infer<typeof ExecutionIntentSchema>;

const ROUTER_SYSTEM = `You are Rearvy's execution router. Your only job is to classify a user's natural-language request into a structured execution intent.

CRITICAL RULES:
- Do not execute anything. Only classify.
- Use exact category names from the list.
- If the request is a casual question or greeting, use category "chat".
- If the request involves irreversible or high-risk operations (sending email, running shell commands, file deletion, financial transactions), mark sensitivity as "high".
- If the request chains multiple distinct actions (e.g., "read my invoices, summarize them, upload to Drive, email accountant"), mark requiresMultiStep as true.
- If the request is vague but implies a tool action, choose the most likely category with a lower confidence score.

Available categories:
- browser: open websites, search, fill forms, automate browsers
- chat: casual conversation, questions, greetings
- code: run code, deploy apps, git operations, fix bugs, write code
- desktop: open apps, manipulate windows, screenshots, file operations on local machine
- email: read, draft, or send emails
- file: read, write, edit, move, organize files and folders
- memory: save or recall personal preferences, contexts, facts
- media: generate or analyze images, videos, audio
- research: web research, deep analysis, document review
- terminal: execute shell commands, install packages, run scripts
- trading: crypto trading, market analysis, portfolio review
- automation: create workflows, triggers, scheduled tasks
- calendar: create, read, modify calendar events
- knowledge: learn new facts, business context, client info
- integration: sync or query connected services (Slack, Notion, Shopify, GitHub, etc.)`;

const CATEGORY_TOOL_HINTS: Record<ExecutionIntentCategory, string[]> = {
  browser: ["runBrowserTask", "searchWeb"],
  chat: [],
  code: ["runTerminalCommand"],
  desktop: ["executeWorkflow"],
  email: ["prepareGmailMessage"],
  file: ["readFile", "writeFile", "listDirectory"],
  memory: ["searchMemories", "saveMemory"],
  media: ["generateMedia", "analyzeMedia"],
  research: ["searchWeb", "fetchWebPage"],
  terminal: ["runTerminalCommand"],
  trading: ["getTradingOpinion", "getBestTradeOpportunity"],
  automation: ["runBrowserTask"],
  calendar: ["getCalendarEvents", "createCalendarEvent"],
  knowledge: ["saveMemory"],
  integration: ["getIntegrationStatus"],
};

const FALLBACK_KEYWORDS: Record<ExecutionIntentCategory, string[]> = {
  browser: ["open", "visit", "browse", "navigate", "website", "url", "search google", "scrape"],
  chat: ["hello", "hi ", "hey", "good morning", "how are you", "what can you do", "help"],
  code: ["run", "deploy", "git", "npm", "build", "test", "node", "python", "fix bug", "refactor"],
  desktop: ["open app", "launch", "screenshot", "screen", "window", "close app", "focus", "desktop"],
  email: ["email", "gmail", "inbox", "send message", "draft email", "reply to"],
  file: ["read file", "write file", "find file", "search files", "open file", "folder", "directory"],
  memory: ["remember", "save this", "later", "my preference", "note that", "don't forget"],
  media: ["generate image", "create image", "make video", "analyze image", "picture", "logo", "poster"],
  research: ["research", "look up", "compare", "find out", "what is", "who is", "deep dive"],
  terminal: ["terminal", "shell", "command", "powershell", "cmd", "bash"],
  trading: ["trade", "bitcoin", "stock", "market", "portfolio", "crypto", "buy", "sell"],
  automation: ["workflow", "schedule", "trigger", "every day", "every hour", "automate"],
  calendar: ["calendar", "schedule meeting", "create event", "add to calendar", "meeting", "appointment"],
  knowledge: ["learn", "remember", "store", "context", "business", "client", "project info"],
  integration: ["slack", "notion", "stripe", "github", "shopify", "drive", "sync"],
};

export async function parseExecutionIntent(
  userMessage: string,
  options: { userId?: string; isDesktopApp?: boolean } = {}
): Promise<ExecutionIntent> {
  const trimmed = userMessage.trim();
  if (!trimmed) {
    return {
      category: "chat",
      action: "general conversation",
      parameters: {},
      confidence: 0.5,
      requiresMultiStep: false,
      sensitivity: "safe",
    };
  }

  const fallback = inferFromKeywords(trimmed);

  try {
    const routed = await resolveModelForChat({
      task: "chat_assistant",
      routingMode: "fast",
      isDesktopApp: options.isDesktopApp,
    });

    if (!routed.model) {
      log.warn("No model available for routing, using fallback heuristic.", { userId: options.userId });
      return fallback;
    }

    const response = await generateObject({
      model: routed.model,
      schema: ExecutionIntentSchema,
      system: ROUTER_SYSTEM,
      prompt: `User request: "${trimmed}"`,
      temperature: 0.1,
      maxOutputTokens: 256,
    });

    const intent = response.object;

    if (intent.confidence < 0.4) {
      log.debug("Low confidence intent, merging with fallback.", {
        fallbackCategory: fallback.category,
        detectedCategory: intent.category,
      });
      return {
        ...intent,
        category: intent.category === "chat" && fallback.category !== "chat" ? fallback.category : intent.category,
        confidence: Math.max(intent.confidence, fallback.confidence),
      };
    }

    log.debug("Intent classified.", { category: intent.category, action: intent.action });
    return intent;
  } catch (error) {
    log.warn("LLM routing failed, using fallback heuristic.", error);
    return fallback;
  }
}

function inferFromKeywords(message: string): ExecutionIntent {
  const lower = message.toLowerCase();
  let bestCategory: ExecutionIntentCategory = "chat";
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(FALLBACK_KEYWORDS)) {
    const score = keywords.reduce((acc, keyword) => acc + (lower.includes(keyword) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category as ExecutionIntentCategory;
    }
  }

  const confidence = Math.min(0.3 + bestScore * 0.15, 0.7);

  return {
    category: bestCategory,
    action: message.slice(0, 80),
    parameters: {},
    confidence: confidence,
    requiresMultiStep: bestScore >= 3,
    sensitivity: ["email", "terminal", "code", "trading", "desktop"].includes(bestCategory) ? "moderate" : "safe",
  };
}

export function getSuggestedTools(intent: ExecutionIntent): string[] {
  return CATEGORY_TOOL_HINTS[intent.category] || [];
}
