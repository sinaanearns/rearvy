import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import {
  aiCompletionService,
  sanitizeModelRouteForClient,
} from "@/lib/ai/model-router";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { user, error } = await requireAuth(request);
  if (error) return error;

  try {
    const { subject, body, to } = await request.json();
    const result = await aiCompletionService.generateText({
      task: "email_draft",
      requestedProviderModel:
        process.env.EMAIL_REFINER_MODEL || "google/gemma-4-31b-it",
      system:
        "You are an expert email copywriter. Refine the provided email for clarity, professional tone, and impact. Keep the length similar to the original unless instructed otherwise.",
      prompt: `Refine this email.
Recipient: ${Array.isArray(to) ? to.join(", ") : to}
Subject: ${subject}
Current Body:
${body}

Return a JSON object with "subject" and "body" fields. Do not include any other text.`,
      userId: user.uid,
      timeoutMs: 20_000,
    });

    if (result.aiUnavailable) {
      return NextResponse.json({
        subject,
        body,
        aiUnavailable: true,
        modelRoute: sanitizeModelRouteForClient(result.modelRoute),
      });
    }

    try {
      // Clean up potential markdown blocks
      const cleanedText = result.text.replace(/```json|```/g, "").trim();
      const parsedResult = JSON.parse(cleanedText);
      return NextResponse.json(parsedResult);
    } catch (parseError) {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return NextResponse.json(JSON.parse(jsonMatch[0]));
      }
      console.error("AI response parsing failed:", result.text);
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
