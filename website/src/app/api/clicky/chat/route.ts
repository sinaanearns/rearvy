import { NextResponse, type NextRequest } from "next/server";
import {
  aiCompletionService,
  buildNoModelConfiguredMessage,
  sanitizeModelRouteForClient,
} from "@/lib/ai/model-router";
import { RESPONSE_LANGUAGE_RULES } from "@/lib/ai/language";
import { sanitizeAssistantText } from "@/lib/ai/sanitize";

export const runtime = "nodejs";

const DEFAULT_CLICKY_VISION_MODEL = "meta/llama-3.2-11b-vision-instruct";
const MAX_MESSAGE_LENGTH = 2000;
const MAX_MEMORY_LENGTH = 240;
const MAX_MEMORY_COUNT = 12;
const MAX_SCREENSHOT_BASE64_LENGTH = 12_000_000;
const MAX_SCREENSHOT_COUNT = 4;
const CLICKY_CHAT_TIMEOUT_MS = 20000;

const CLICKY_SYSTEM_PROMPT = `You are Clicky, Rearvy's desktop assistant.
Reply directly to the user's latest command in one or two concise sentences.
Correct obvious typos and near-miss app names silently. If the intent is clear, proceed with the safest interpretation instead of asking the user to rephrase.
If the user asks what you can do, explain that in the Rearvy desktop app you can run desktop workflows for screenshots, mouse movement, clicks, drags, scrolling, typing, key presses, clipboard actions, opening apps, Rearvy workflows, research summaries, and next-step guidance.
If the user asks whether you can control the mouse or interact with the device, say yes through Clicky's desktop bridge. Do not say that you cannot control the mouse.
Use stored Clicky memories when they are relevant, especially for names, preferences, goals, and saved context.
Do not invent memories. If a direct memory answer is not stored, say you do not have that saved yet.
Do not claim you clicked, opened, searched, scraped, sent, shared, or changed anything unless the prompt says that action already completed.
If the request needs private data, files, credentials, payments, or irreversible changes, ask for the specific non-sensitive details needed or explain the constraint directly.

${RESPONSE_LANGUAGE_RULES}`;

const CLICKY_SCREEN_SYSTEM_PROMPT = `You are Clicky, Rearvy's desktop assistant with screen vision.
The user has asked you to inspect a screenshot that Clicky just captured.
Describe what is visible in one to three concise sentences, focusing on the main app, page, window, controls, alerts, and obvious state.
Correct obvious typos in the user's wording before answering. If the user asks with a typo, answer the likely intended question directly.
If the user asks what you see, answer directly. If the screen suggests a useful next step, include it briefly.
When pointing at a visible UI element would help the user, append one point tag at the very end of the response.
Use the labeled image pixel dimensions as the coordinate space, with 0,0 at the top-left.
Point tag format: [POINT:x,y:label] for the cursor screen, or [POINT:x,y:label:screenN] for another labeled screen.
If pointing would not help, append [POINT:none].
Do not read passwords, API keys, tokens, private keys, payment details, or recovery phrases aloud; say sensitive content appears to be present without repeating it.
Use stored Clicky memories only when they are relevant.

${RESPONSE_LANGUAGE_RULES}`;

const CLICKY_ACTION_PLAN_SYSTEM_PROMPT = `You are Clicky, Rearvy's desktop assistant with screen vision.
The user wants help with the visible screen. Plan at most one safe mouse action that directly addresses the request.
Return exactly one JSON object and no markdown.
Allowed action:
- "click": one low-risk left click on a visible control that directly addresses the user's issue, such as Allow, Enable, Retry, Continue, Open settings, or a harmless focus/dismiss control.
- "none": when the next action is unclear, risky, hidden, or needs private judgment.
Never propose payments, purchases, sending/sharing data, deleting files, revealing secrets, installing software, admin elevation, or accepting legal/security prompts.
Use normalized coordinates from 0 to 1 relative to the screenshot top-left.
JSON shape:
{"action":"click"|"none","label":"short visible control name","reason":"why this is the next step","x":0.5,"y":0.5,"confidence":0.0,"risk":"low"|"medium"|"high"}

${RESPONSE_LANGUAGE_RULES}`;

type ClickyMemory = {
  key: string;
  label: string;
  kind: string;
  content: string;
  importance: number;
};

type ClickyActionPlan = {
  action: "click" | "none";
  label: string;
  reason: string;
  x?: number;
  y?: number;
  confidence: number;
  risk: "low" | "medium" | "high";
};

type ClickyScreenshotInput = {
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

function coerceScreenshots(value: unknown): ClickyScreenshotInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(0, MAX_SCREENSHOT_COUNT)
    .map((item, index): ClickyScreenshotInput | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const image = coerceScreenshotBase64(record.image ?? record.screenshot ?? record.data);
      if (!image) {
        return null;
      }

      return {
        image,
        label: coerceScreenshotLabel(record.label, `Screen ${index + 1}`),
        isCursorScreen: record.isCursorScreen === true,
        width: coercePositiveInteger(record.width ?? record.screenshotWidth ?? record.screenshotWidthInPixels),
        height: coercePositiveInteger(record.height ?? record.screenshotHeight ?? record.screenshotHeightInPixels),
      };
    })
    .filter((item): item is ClickyScreenshotInput => Boolean(item));
}

function coercePositiveInteger(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return undefined;
  }

  return Math.round(number);
}

function buildScreenshotInputs(singleScreenshot: string, screenshots: ClickyScreenshotInput[]) {
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
  screenshots: ClickyScreenshotInput[]
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

function getClickyVisionModel() {
  return (
    readOptionalEnvModel(process.env.CLICKY_VISION_MODEL) ||
    readOptionalEnvModel(process.env.NVIDIA_VISION_MODEL) ||
    DEFAULT_CLICKY_VISION_MODEL
  );
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function extractJsonObject(value: string) {
  const text = value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return "";
  }

  return text.slice(start, end + 1);
}

function coerceRisk(value: unknown): ClickyActionPlan["risk"] {
  return value === "medium" || value === "high" ? value : "low";
}

function coerceActionPlan(value: string): ClickyActionPlan {
  const fallback: ClickyActionPlan = {
    action: "none",
    label: "No safe action",
    reason: "I could not identify one safe mouse action from the visible screen.",
    confidence: 0,
    risk: "medium",
  };

  try {
    const parsed = JSON.parse(extractJsonObject(value) || "{}") as Record<string, unknown>;
    const action = parsed.action === "click" ? "click" : "none";
    const x = Number(parsed.x);
    const y = Number(parsed.y);
    const confidence = Number(parsed.confidence);
    const risk = coerceRisk(parsed.risk);
    const label = coerceMemoryText(parsed.label, 80) || (action === "click" ? "Click visible control" : fallback.label);
    const reason = coerceMemoryText(parsed.reason, 220) || fallback.reason;

    if (action !== "click") {
      return {
        action: "none",
        label,
        reason,
        confidence: Number.isFinite(confidence) ? clamp01(confidence) : 0,
        risk,
      };
    }

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return {
        ...fallback,
        reason: "The action plan did not include usable screen coordinates.",
      };
    }

    return {
      action,
      label,
      reason,
      x: clamp01(x),
      y: clamp01(y),
      confidence: Number.isFinite(confidence) ? clamp01(confidence) : 0.5,
      risk,
    };
  } catch {
    return fallback;
  }
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

    const memoryPrompt = `Stored Clicky memories:
${formatMemories(memories)}

User command: ${message}`;

    const useActionPlanner = mode === "action_plan" && hasScreenshot;
    const result = await aiCompletionService.generateText(
      useActionPlanner
        ? {
            task: "screen_analysis",
            requestedProviderModel: getClickyVisionModel(),
            hasImageInput: true,
            system: CLICKY_ACTION_PLAN_SYSTEM_PROMPT,
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
            timeoutMs: CLICKY_CHAT_TIMEOUT_MS,
          }
        : hasScreenshot
        ? {
            task: "screen_analysis",
            requestedProviderModel: getClickyVisionModel(),
            hasImageInput: true,
            system: CLICKY_SCREEN_SYSTEM_PROMPT,
            messages: [
              {
                role: "user",
                content: buildScreenMessageContent(
                  memoryPrompt,
                  "Analyze the screenshot context Clicky captured for this command.",
                  screenshots
                ),
              },
            ],
            maxOutputTokens: 360,
            temperature: 0.2,
            timeoutMs: CLICKY_CHAT_TIMEOUT_MS,
          }
        : {
            task: "chat_assistant",
            requestedProviderModel: readOptionalEnvModel(process.env.CLICKY_CHAT_MODEL),
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

    const rawResultText = typeof result.text === "string" ? result.text : "";
    const sanitizedResultText = sanitizeAssistantText(rawResultText);
    const reply = coerceMessage(sanitizedResultText) || "I heard you, but I do not have a useful reply yet.";
    const actionPlan = useActionPlanner ? coerceActionPlan(sanitizedResultText || rawResultText) : null;

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
