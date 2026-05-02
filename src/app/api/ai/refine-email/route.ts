import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { user, error } = await requireAuth(request);
  if (error) return error;

  try {
    const { subject, body, to } = await request.json();

    const providerApiKey = process.env.Gamma?.trim();
    if (!providerApiKey) {
      return NextResponse.json(
        { error: "Gamma API key not configured" },
        { status: 503 }
      );
    }

    const nvidia = createOpenAI({
      baseURL: "https://integrate.api.nvidia.com/v1",
      apiKey: providerApiKey,
    });

    const { text } = await generateText({
      model: nvidia.chat("google/gemma-4-31b-it"),
      system:
        "You are an expert email copywriter. Refine the provided email for clarity, professional tone, and impact. Keep the length similar to the original unless instructed otherwise.",
      prompt: `Refine this email.
Recipient: ${Array.isArray(to) ? to.join(", ") : to}
Subject: ${subject}
Current Body:
${body}

Return a JSON object with "subject" and "body" fields. Do not include any other text.`,
    });

    try {
      // Clean up potential markdown blocks
      const cleanedText = text.replace(/```json|```/g, "").trim();
      const result = JSON.parse(cleanedText);
      return NextResponse.json(result);
    } catch (parseError) {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return NextResponse.json(JSON.parse(jsonMatch[0]));
      }
      console.error("AI response parsing failed:", text);
      throw parseError;
    }
  } catch (err) {
    console.error("Refine email error:", err);
    return NextResponse.json(
      { error: "Failed to refine email" },
      { status: 500 }
    );
  }
}
