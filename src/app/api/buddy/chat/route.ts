import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { NextRequest } from "next/server";

// Use the project's NVIDIA API (AI_API_KEY) – never any external service
const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const VISION_MODEL = "meta/llama-3.2-11b-vision-instruct";
const TEXT_MODEL = "mistralai/ministral-14b-instruct-2512";

const BUDDY_SYSTEM_PROMPT = `You are Rearvy Buddy, an always-visible AI financial assistant that lives next to the user's cursor.

Your core personality:
- You are a sharp, concise financial analyst and advisor
- You see the user's screen and give contextually relevant financial insights
- You speak in short, punchy sentences — never more than 3-4 sentences per response
- You proactively notice financial data, charts, numbers, and market signals on screen
- You call out opportunities, risks, and anomalies you spot

Your financial capabilities:
- Analyze stocks, crypto, forex, indices from what you see on screen
- Give buy/sell/hold signals with brief reasoning
- Spot patterns in charts and price data
- Calculate risk-reward ratios instantly
- Identify market sentiment from news or social content you see
- Explain financial concepts simply and clearly

Pointing behavior:
- You can point at specific elements on screen using [POINT:x,y:label] tags
- Use this to highlight important numbers, chart patterns, or UI elements
- Example: [POINT:0.3,0.5:RSI divergence here] — coordinates are 0-1 range (relative to screen)

Tone: Confident, direct, a little witty. Like a brilliant trading desk colleague who's always watching your back.
Never say "I cannot" — always try to help with what you can see.`;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.AI_API_KEY || process.env.NVIDIA_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "AI API key not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { message, screenshotBase64, conversationHistory = [] } = body;

    if (!message && !screenshotBase64) {
      return new Response(
        JSON.stringify({ error: "message or screenshot required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const nvidia = createOpenAI({
      baseURL: NVIDIA_BASE_URL,
      apiKey,
    });

    // Decide model: vision if screenshot provided
    const modelId = screenshotBase64 ? VISION_MODEL : TEXT_MODEL;
    const model = nvidia(modelId);

    // Build the user message with optional screenshot
    const userContent: Array<{ type: string; text?: string; image?: string }> = [];

    if (screenshotBase64) {
      userContent.push({
        type: "image",
        image: screenshotBase64,
      });
    }

    userContent.push({
      type: "text",
      text: message || "What do you see on my screen? Give me financial insights.",
    });

    // Build messages array
    const messages = [
      ...conversationHistory.slice(-6), // keep last 3 exchanges
      {
        role: "user" as const,
        content: screenshotBase64
          ? userContent
          : message,
      },
    ];

    const result = streamText({
      model,
      system: BUDDY_SYSTEM_PROMPT,
      messages,
      maxOutputTokens: 300,
      temperature: 0.7,
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("[buddy/chat] error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
