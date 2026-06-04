import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/firebase/middleware";
import {
  aiCompletionService,
  sanitizeModelRouteForClient,
  type AIProviderTask,
  type ModelProviderId,
} from "@/lib/ai/model-router";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";

export const runtime = "nodejs";

const ProviderIdSchema = z.enum([
  "local_ollama",
  "openrouter",
  "nvidia",
  "groq",
  "together",
  "openai",
]);

const TaskSchema = z.enum([
  "chat_assistant",
  "summary",
  "email_draft",
  "memory_tagging",
  "analytics_explanation",
  "deep_business_reasoning",
  "json_classification",
  "route_selection",
  "workflow_reasoning",
  "screen_analysis",
]);

const ProviderTestSchema = z.object({
  providerId: ProviderIdSchema,
  model: z.string().trim().max(200).optional(),
  task: TaskSchema.default("chat_assistant"),
  prompt: z
    .string()
    .trim()
    .max(500)
    .default("Reply with a short health check sentence for Rearvy."),
});

const rateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

function isRateLimited(key: string) {
  const now = Date.now();
  const current = rateLimit.get(key);
  if (!current || current.resetAt <= now) {
    rateLimit.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (current.count >= RATE_LIMIT_MAX) {
    return true;
  }

  current.count += 1;
  return false;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const user = auth.user;
  if (isRateLimited(user.uid)) {
    return NextResponse.json(
      { error: "Too many provider test requests." },
      { status: 429 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await readJsonRecord(request);
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    throw error;
  }

  const parsed = ProviderTestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid provider test request.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const startedAt = Date.now();
  try {
    const result = await aiCompletionService.generateText({
      providerId: parsed.data.providerId as ModelProviderId,
      task: parsed.data.task as AIProviderTask,
      requestedProviderModel: parsed.data.model,
      prompt: parsed.data.prompt,
      maxOutputTokens: 80,
      temperature: 0,
      userId: user.uid,
      timeoutMs: 20_000,
    });

    return NextResponse.json({
      ok: !result.aiUnavailable,
      latencyMs: Date.now() - startedAt,
      text: result.text.slice(0, 500),
      modelRoute: sanitizeModelRouteForClient(result.modelRoute),
      aiUnavailable: Boolean(result.aiUnavailable),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "Provider test failed.",
      },
      { status: 502 }
    );
  }
}
