import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import {
  aiCompletionService,
  sanitizeModelRouteForClient,
} from "@/lib/ai/model-router";
import { createServerLogger } from "@/lib/server-logger";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import { parseRefinedEmailDraft } from "@/lib/ai/email-refinement";

export const runtime = "nodejs";

const log = createServerLogger("RefineEmailApi");

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readRecipients(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .join(", ");
  }

  return readString(value);
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireAuth(request);
  if (error) return error;

  try {
    const requestBody = await readJsonRecord(request);
    const subject = readString(requestBody.subject);
    const body = readString(requestBody.body);
    const to = readRecipients(requestBody.to);

    if (!body) {
      return NextResponse.json(
        { error: "Email body is required." },
        { status: 400 }
      );
    }

    const result = await aiCompletionService.generateText({
      task: "email_draft",
      requestedProviderModel:
        process.env.EMAIL_REFINER_MODEL || "google/gemma-4-31b-it",
      system:
        "You are an expert email copywriter. Refine the provided email for clarity, professional tone, and impact. Keep the length similar to the original unless instructed otherwise.",
      prompt: `Refine this email.
Recipient: ${to || "Not specified"}
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

    const parsedResult = parseRefinedEmailDraft(result.text);
    if (!parsedResult) {
      log.error("AI response parsing failed", {
        responseLength: result.text.length,
        modelRoute: sanitizeModelRouteForClient(result.modelRoute),
      });
      return NextResponse.json(
        { error: "Failed to parse refined email" },
        { status: 502 }
      );
    }

    return NextResponse.json(parsedResult);
  } catch (err) {
    if (isRequestBodyError(err)) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    log.error("Refine email error:", err);
    return NextResponse.json(
      { error: "Failed to refine email" },
      { status: 500 }
    );
  }
}
