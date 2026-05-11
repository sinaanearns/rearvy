import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { NextRequest } from "next/server";

// NVIDIA API Configuration
const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
// Vision model for screen analysis
const VISION_MODEL = "meta/llama-3.2-11b-vision-instruct";
// Faster text model for pure chat
const TEXT_MODEL = "mistralai/ministral-14b-instruct-2512";

const BUDDY_SYSTEM_PROMPT = `You are Rearvy Buddy, an elite AI Financial Assistant that lives in the user's workspace.
Your mission is to provide lightning-fast financial insights, data analysis, and proactive market alerts.

CORE CAPABILITIES:
1. SCREEN INTELLIGENCE: You see exactly what the user sees. Identify charts, price tables, revenue numbers, and growth metrics.
2. FINANCIAL ANALYSIS: Interpret complex data instantly. Calculate burn rates, LTV/CAC, stock signals (RSI, MACD), or crypto sentiment.
3. PROACTIVE GUIDANCE: If you see something concerning (e.g., a sudden drop in a metric) or an opportunity (e.g., a breakout pattern), call it out.
4. UI INTERACTION: You can "point" at elements on the screen to guide the user.

POINTING PROTOCOL:
When you want to draw the user's attention to a specific area on their screen, use the [POINT:x,y:label] tag.
- Coordinates (x,y) are from 0.0 to 1.0 representing the screen percentage.
- Label is a short description of what you are pointing at.
Example: "[POINT:0.3,0.45:Revenue spike here] Look at this sudden increase in sales last Tuesday."

TONE & STYLE:
- Professional, sharp, and concise.
- Use financial terminology accurately.
- No fluff. Every sentence should add value.
- Be proactive. Don't just answer; advise.

If no screenshot is provided, focus on text-based financial queries or provide a summary of what you've learned from previous screenshots.`;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.AI_API_KEY || process.env.NVIDIA_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "NVIDIA API key (AI_API_KEY) is missing in environment." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const { message, screenshot, history = [] } = await req.json();

    const nvidia = createOpenAI({
      baseURL: NVIDIA_BASE_URL,
      apiKey,
    });

    const modelId = screenshot ? VISION_MODEL : TEXT_MODEL;
    const model = nvidia(modelId);

    const messages = [
      ...history.slice(-10), // Keep recent context
      {
        role: "user",
        content: screenshot
          ? [
              { type: "text", text: message || "Analyze my screen for financial insights." },
              { type: "image", image: screenshot } // Assume base64
            ]
          : message
      }
    ];

    const result = streamText({
      model,
      system: BUDDY_SYSTEM_PROMPT,
      messages,
      maxOutputTokens: 500,
      temperature: 0.2, // Low temperature for factual financial analysis
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("[Buddy API Error]:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process buddy request." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
