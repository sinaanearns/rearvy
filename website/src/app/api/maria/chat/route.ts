import { NextResponse, type NextRequest } from "next/server";
import {
  aiCompletionService,
  buildNoModelConfiguredMessage,
  sanitizeModelRouteForClient,
} from "@/lib/ai/model-router";
import { RESPONSE_LANGUAGE_RULES } from "@/lib/ai/language";
import { sanitizeAssistantText } from "@/lib/ai/sanitize";
import {
  coerceMariaConversationHistory,
  formatMariaConversationHistory,
} from "@/lib/maria/conversation-history";
import {
  coerceMariaActionPlan,
  type MariaActionPlan,
} from "@/lib/maria/action-plan";
import { isRecord, isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import { createServerLogger } from "@/lib/server-logger";

export const runtime = "nodejs";

const DEFAULT_MARIA_VISION_MODEL = "meta/llama-3.2-11b-vision-instruct";
const MAX_MESSAGE_LENGTH = 2000;
const MAX_MEMORY_LENGTH = 240;
const MAX_MEMORY_COUNT = 12;
const MAX_SCREENSHOT_BASE64_LENGTH = 12_000_000;
const MAX_SCREENSHOT_COUNT = 4;
const MARIA_CHAT_TIMEOUT_MS = 20000;
const log = createServerLogger("MariaChatApi");

const MARIA_SYSTEM_PROMPT = `You are Maria, Rearvy's desktop assistant.
Reply directly to the user's latest command in one or two concise sentences.
If the user calls you Clicky, treat Clicky as an alias for Maria's desktop assistant capability.
Use the recent Maria conversation to resolve follow-up words like "that", "it", "again", "what about", or "continue", but always answer the latest user command.
Correct obvious typos and near-miss app names silently. If the intent is clear, proceed with the safest interpretation instead of asking the user to rephrase.
If the user asks what you can do, explain that in the Rearvy desktop app you can run desktop workflows for screenshots, mouse movement, clicks, drags, scrolling, typing, key presses, clipboard actions, opening apps, Rearvy workflows, research summaries, and next-step guidance.
If the user asks whether you can control the mouse or interact with the device, say yes through Maria's desktop bridge. Do not say that you cannot control the mouse.
If the user asks to read the device, explain that you can inspect visible screens and read specific files or folders through explicit desktop commands; do not claim unrestricted background reading.
Use stored Maria memories when they are relevant, especially for names, preferences, goals, and saved context.
Do not invent memories. If a direct memory answer is not stored, say you do not have that saved yet.
Do not claim you clicked, opened, searched, scraped, sent, shared, or changed anything unless the latest prompt says that action already completed.
If the request needs private data, files, credentials, payments, or irreversible changes, ask for the specific non-sensitive details needed or explain the constraint directly.

${RESPONSE_LANGUAGE_RULES}`;

const MARIA_SCREEN_SYSTEM_PROMPT = `You are Maria, Rearvy's desktop assistant with screen vision.
The user has asked you to inspect a screenshot that Maria just captured.
Describe what is visible in one to three concise sentences, focusing on the main app, page, window, controls, alerts, and obvious state.
Use recent Maria conversation only to understand follow-up references; the screenshot and latest command are the source of truth for visible state.
Correct obvious typos in the user's wording before answering. If the user asks with a typo, answer the likely intended question directly.
If the user asks what you see, answer directly. If the screen suggests a useful next step, include it briefly.
When pointing at a visible UI element would help the user, append one point tag at the very end of the response.
Only point at a specific visible element with a readable label, icon identity, button text, field, alert, or active control. Do not point at vague regions such as "the page", "the window", "some text", or a blank area.
Prefer the element that the user can act on next. If the request is general screen reading and no single target is useful, use [POINT:none].
Use the labeled image pixel dimensions as the coordinate space, with 0,0 at the top-left.
Keep point labels short and concrete, for example "Send button", "API key field", or "Download link".
Point tag format: [POINT:x,y:label] for the cursor screen, or [POINT:x,y:label:screenN] for another labeled screen.
If pointing would not help, append [POINT:none].
Do not read passwords, API keys, tokens, private keys, payment details, or recovery phrases aloud; say sensitive content appears to be present without repeating it.
Use stored Maria memories only when they are relevant.

${RESPONSE_LANGUAGE_RULES}`;

const MARIA_ACTION_PLAN_SYSTEM_PROMPT = `You are Maria, Rearvy's desktop assistant with screen vision.
The user wants help with the visible screen. Plan at most one safe mouse action that directly addresses the request.
Return exactly one JSON object and no markdown.
Allowed action:
- "click": one low-risk left click on a visible control that directly addresses the user's issue or the visible target they explicitly named, such as Allow, Enable, Retry, Continue, Open settings, a requested tab/button/link, or a harmless focus/dismiss control.
- "none": when the next action is unclear, risky, hidden, or needs private judgment.
Click only if the control is visible, specific, and likely to be correct from the screenshot alone.
Use the most specific visible label you can read. Do not use labels like "button", "here", "this", "window", or "screen".
Never propose payments, purchases, sending/sharing data, deleting files, revealing secrets, installing software, admin elevation, or accepting legal/security prompts.
If the user only asks whether Maria/Clicky can control the device and does not name a target or visible problem, return "none".
Use normalized coordinates from 0 to 1 relative to the screenshot top-left.
JSON shape:
{"action":"click"|"none","label":"short visible control name","reason":"why this is the next step","x":0.5,"y":0.5,"confidence":0.0,"risk":"low"|"medium"|"high"}

${RESPONSE_LANGUAGE_RULES}`;

type MariaMemory = {
  key: string;
  label: string;
  kind: string;
  content: string;
  importance: number;
};

type MariaScreenshotInput = {
  image: string;
  label: string;
  isCursorScreen: boolean;
  width?: number;
  height?: number;
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

function coerceScreenshotLabel(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  return value.replace(/\s+/g, " ").trim().slice(0, 140) || fallback;
}

function coerceScreenshots(value: unknown): MariaScreenshotInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(0, MAX_SCREENSHOT_COUNT)
    .map((item, index): MariaScreenshotInput | null => {
      if (!isRecord(item)) {
        return null;
      }

      const image = coerceScreenshotBase64(item.image ?? item.screenshot ?? item.data);
      if (!image) {
        return null;
      }

      return {
        image,
        label: coerceScreenshotLabel(item.label, `Screen ${index + 1}`),
        isCursorScreen: item.isCursorScreen === true,
        width: coercePositiveInteger(item.width ?? item.screenshotWidth ?? item.screenshotWidthInPixels),
        height: coercePositiveInteger(item.height ?? item.screenshotHeight ?? item.screenshotHeightInPixels),
      };
    })
    .filter((item): item is MariaScreenshotInput => Boolean(item));
}

function coercePositiveInteger(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return undefined;
  }

  return Math.round(number);
}

function buildScreenshotInputs(singleScreenshot: string, screenshots: MariaScreenshotInput[]) {
  if (screenshots.length > 0) {
    const hasCursorScreen = screenshots.some((item) => item.isCursorScreen);
    return screenshots.map((item, index) => ({
      ...item,
      isCursorScreen: hasCursorScreen ? item.isCursorScreen : index === 0,
    }));
  }

  return singleScreenshot
    ? [
        {
          image: singleScreenshot,
          label: "Captured screen",
          isCursorScreen: true,
        },
      ]
    : [];
}

function buildScreenMessageContent(
  memoryPrompt: string,
  promptText: string,
  screenshots: MariaScreenshotInput[]
) {
  const content: Array<{ type: "text"; text: string } | { type: "image"; image: string }> = [
    {
      type: "text",
      text: `${memoryPrompt}

${promptText}

Screens are labeled before each image. Prioritize the cursor screen when the user's request is about the current pointer focus.`,
    },
  ];

  for (const screenshot of screenshots) {
    content.push({
      type: "text",
      text: [
        screenshot.label,
        screenshot.isCursorScreen ? "(cursor screen)" : "",
        screenshot.width && screenshot.height ? `(image dimensions: ${screenshot.width}x${screenshot.height} pixels)` : "",
      ]
        .filter(Boolean)
        .join(" "),
    });
    content.push({
      type: "image",
      image: screenshot.image,
    });
  }

  return content;
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

function coerceMode(value: unknown) {
  return value === "action_plan" ? "action_plan" : "chat";
}

function getMariaVisionModel() {
  return (
    readOptionalEnvModel(process.env.MARIA_VISION_MODEL) ||
    readOptionalEnvModel(process.env.NVIDIA_VISION_MODEL) ||
    DEFAULT_MARIA_VISION_MODEL
  );
}

function coerceMemories(value: unknown): MariaMemory[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(0, MAX_MEMORY_COUNT)
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const content = coerceMemoryText(item.content);
      if (!content) {
        return null;
      }

      return {
        key: coerceMemoryText(item.key, 80),
        label: coerceMemoryText(item.label, 80) || "Memory",
        kind: coerceMemoryText(item.kind, 40) || "context",
        content,
        importance: Number.isFinite(Number(item.importance))
          ? Number(item.importance)
          : 0,
      };
    })
    .filter((memory): memory is MariaMemory => Boolean(memory));
}

function formatMemories(memories: MariaMemory[]) {
  if (memories.length === 0) {
    return "No Maria memories saved yet.";
  }

  return memories
    .map((memory) => `- ${memory.label}: ${memory.content}`)
    .join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonRecord(request);
    const message = coerceMessage(body?.message ?? body?.command);
    const memories = coerceMemories(body?.memories);
    const history = coerceMariaConversationHistory(body?.history ?? body?.conversationHistory);
    const screenshot = coerceScreenshotBase64(body?.screenshot);
    const screenshots = buildScreenshotInputs(screenshot, coerceScreenshots(body?.screenshots));
    const plannerScreenshot = screenshots.find((item) => item.isCursorScreen)?.image || screenshots[0]?.image || "";
    const mode = coerceMode(body?.mode);
    const hasScreenshot = screenshots.length > 0;

    if (!message) {
      return NextResponse.json(
        { ok: false, reply: "I need a command before I can respond." },
        { status: 400 }
      );
    }

    const memoryPrompt = `Stored Maria memories:
${formatMemories(memories)}

Recent Maria conversation:
${formatMariaConversationHistory(history)}

Latest user command: ${message}`;

    const useActionPlanner = mode === "action_plan" && hasScreenshot;
    const result = await aiCompletionService.generateText(
      useActionPlanner
        ? {
            task: "screen_analysis",
            requestedProviderModel: getMariaVisionModel(),
            hasImageInput: true,
            system: MARIA_ACTION_PLAN_SYSTEM_PROMPT,
            messages: [
              {
                role: "user",
                content: buildScreenMessageContent(
                  memoryPrompt,
                  "Plan one mouse action for the visible issue on the cursor screen. Return JSON only.",
                  [
                    {
                      image: plannerScreenshot,
                      label: "Cursor screen",
                      isCursorScreen: true,
                    },
                  ]
                ),
              },
            ],
            maxOutputTokens: 220,
            temperature: 0.1,
            timeoutMs: MARIA_CHAT_TIMEOUT_MS,
          }
        : hasScreenshot
        ? {
            task: "screen_analysis",
            requestedProviderModel: getMariaVisionModel(),
            hasImageInput: true,
            system: MARIA_SCREEN_SYSTEM_PROMPT,
            messages: [
              {
                role: "user",
                content: buildScreenMessageContent(
                  memoryPrompt,
                  "Analyze the screenshot context Maria captured for this command.",
                  screenshots
                ),
              },
            ],
            maxOutputTokens: 360,
            temperature: 0.2,
            timeoutMs: MARIA_CHAT_TIMEOUT_MS,
          }
        : {
            task: "chat_assistant",
            requestedProviderModel: readOptionalEnvModel(process.env.MARIA_CHAT_MODEL),
            system: MARIA_SYSTEM_PROMPT,
            prompt: memoryPrompt,
            maxOutputTokens: 180,
            temperature: 0.3,
            timeoutMs: MARIA_CHAT_TIMEOUT_MS,
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

    const rawResultText = typeof result.text === "string" ? result.text : "";
    const sanitizedResultText = sanitizeAssistantText(rawResultText);
    const reply = coerceMessage(sanitizedResultText) || "I heard you, but I do not have a useful reply yet.";
    const actionPlan = useActionPlanner ? coerceMariaActionPlan(sanitizedResultText || rawResultText) : null;

    return NextResponse.json({
      ok: true,
      reply: actionPlan
        ? actionPlan.action === "click"
          ? `I can ${actionPlan.label}. ${actionPlan.reason}`
          : actionPlan.reason
        : reply,
      actionPlan,
      modelRoute: sanitizeModelRouteForClient(result.modelRoute),
    });
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json(
        {
          ok: false,
          reply: error.message,
        },
        { status: 400 }
      );
    }

    log.error("[Maria chat API] error:", error);
    return NextResponse.json(
      {
        ok: false,
        reply: "I could not generate a reply right now.",
      },
      { status: 500 }
    );
  }
}
