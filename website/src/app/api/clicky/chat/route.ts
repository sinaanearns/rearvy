import { NextResponse, type NextRequest } from "next/server";
import {
  aiCompletionService,
  buildNoModelConfiguredMessage,
  sanitizeModelRouteForClient,
} from "@/lib/ai/model-router";

export const runtime = "nodejs";

const DEFAULT_CLICKY_VISION_MODEL = "meta/llama-3.2-11b-vision-instruct";
const MAX_MESSAGE_LENGTH = 2000;
const MAX_MEMORY_LENGTH = 240;
const MAX_MEMORY_COUNT = 12;
const MAX_SCREENSHOT_BASE64_LENGTH = 12_000_000;
const CLICKY_CHAT_TIMEOUT_MS = 20000;

const CLICKY_SYSTEM_PROMPT = `You are Clicky, Rearvy's desktop assistant.
Reply directly to the user's latest command in one or two concise sentences.
If the user asks what you can do, explain that you can answer quick questions, help with Rearvy workflows, summarize research or pages when those tools run, and guide next steps.
Use stored Clicky memories when they are relevant, especially for names, preferences, goals, and saved context.
Do not invent memories. If a direct memory answer is not stored, say you do not have that saved yet.
Do not claim you clicked, opened, searched, scraped, approved, sent, shared, or changed anything unless the prompt says that action already completed.
If the request needs private data, files, credentials, payments, or owner approval, tell the user you need approval or more context before acting.`;

const CLICKY_SCREEN_SYSTEM_PROMPT = `You are Clicky, Rearvy's desktop assistant with screen vision.
The user has asked you to inspect a screenshot that Clicky just captured.
Describe what is visible in one to three concise sentences, focusing on the main app, page, window, controls, alerts, and obvious state.
If the user asks what you see, answer directly. If the screen suggests a useful next step, include it briefly.
Do not read passwords, API keys, tokens, private keys, payment details, or recovery phrases aloud; say sensitive content appears to be present without repeating it.
Use stored Clicky memories only when they are relevant.`;

type ClickyMemory = {
  key: string;
  label: string;
  kind: string;
  content: string;
  importance: number;
};

function coerceMessage(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, MAX_MESSAGE_LENGTH);
}

function coerceScreenshotBase64(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  const base64 = trimmed.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/i, "").replace(/\s+/g, "");

  if (!base64 || base64.length > MAX_SCREENSHOT_BASE64_LENGTH) {
    return "";
  }

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    return "";
  }

  return base64;
}

function coerceMemoryText(value: unknown, maxLength = MAX_MEMORY_LENGTH) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function readOptionalEnvModel(value: string | undefined) {
  return value?.trim() || undefined;
}

function coerceMemories(value: unknown): ClickyMemory[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(0, MAX_MEMORY_COUNT)
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const content = coerceMemoryText(record.content);
      if (!content) {
        return null;
      }

      return {
        key: coerceMemoryText(record.key, 80),
        label: coerceMemoryText(record.label, 80) || "Memory",
        kind: coerceMemoryText(record.kind, 40) || "context",
        content,
        importance: Number.isFinite(Number(record.importance))
          ? Number(record.importance)
          : 0,
      };
    })
    .filter((memory): memory is ClickyMemory => Boolean(memory));
}

function formatMemories(memories: ClickyMemory[]) {
  if (memories.length === 0) {
    return "No Clicky memories saved yet.";
  }

  return memories
    .map((memory) => `- ${memory.label}: ${memory.content}`)
    .join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const message = coerceMessage(body?.message ?? body?.command);
    const memories = coerceMemories(body?.memories);
    const screenshot = coerceScreenshotBase64(body?.screenshot);
    const hasScreenshot = Boolean(screenshot);

    if (!message) {
      return NextResponse.json(
        { ok: false, reply: "I need a command before I can respond." },
        { status: 400 }
      );
    }

    const memoryPrompt = `Stored Clicky memories:
${formatMemories(memories)}

User command: ${message}`;

    const result = await aiCompletionService.generateText(
      hasScreenshot
        ? {
            task: "screen_analysis",
            requestedProviderModel:
              readOptionalEnvModel(process.env.CLICKY_VISION_MODEL) ||
              readOptionalEnvModel(process.env.NVIDIA_VISION_MODEL) ||
              DEFAULT_CLICKY_VISION_MODEL,
            hasImageInput: true,
            system: CLICKY_SCREEN_SYSTEM_PROMPT,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `${memoryPrompt}

Analyze the screenshot Clicky captured for this command.`,
                  },
                  {
                    type: "image",
                    image: screenshot,
                  },
                ],
              },
            ],
            maxOutputTokens: 360,
            temperature: 0.2,
            timeoutMs: CLICKY_CHAT_TIMEOUT_MS,
          }
        : {
            task: "chat_assistant",
            requestedProviderModel:
              readOptionalEnvModel(process.env.CLICKY_CHAT_MODEL),
            system: CLICKY_SYSTEM_PROMPT,
            prompt: memoryPrompt,
            maxOutputTokens: 180,
            temperature: 0.3,
            timeoutMs: CLICKY_CHAT_TIMEOUT_MS,
          }
    );

    if (result.aiUnavailable) {
      return NextResponse.json({
        ok: true,
        reply: buildNoModelConfiguredMessage(),
        aiUnavailable: true,
        modelRoute: sanitizeModelRouteForClient(result.modelRoute),
      });
    }

    const reply = coerceMessage(result.text) || "I heard you, but I do not have a useful reply yet.";

    return NextResponse.json({
      ok: true,
      reply,
      modelRoute: sanitizeModelRouteForClient(result.modelRoute),
    });
  } catch (error) {
    console.error("[Clicky chat API] error:", error);
    return NextResponse.json(
      {
        ok: false,
        reply: "I could not generate a reply right now.",
      },
      { status: 500 }
    );
  }
}
