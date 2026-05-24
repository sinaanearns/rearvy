import { generateText } from "ai";
import { NextResponse, type NextRequest } from "next/server";
import {
  buildNoModelConfiguredMessage,
  resolveModelForChat,
} from "@/lib/ai/model-router";

export const runtime = "nodejs";

const DEFAULT_CLICKY_MODEL = "mistralai/ministral-14b-instruct-2512";
const MAX_MESSAGE_LENGTH = 2000;
const CLICKY_CHAT_TIMEOUT_MS = 20000;

const CLICKY_SYSTEM_PROMPT = `You are Clicky, Rearvy's desktop assistant.
Reply directly to the user's latest command in one or two concise sentences.
If the user asks what you can do, explain that you can answer quick questions, help with Rearvy workflows, summarize research or pages when those tools run, and guide next steps.
Do not claim you clicked, opened, searched, scraped, approved, sent, shared, or changed anything unless the prompt says that action already completed.
If the request needs private data, files, credentials, payments, or owner approval, tell the user you need approval or more context before acting.`;

function coerceMessage(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, MAX_MESSAGE_LENGTH);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const message = coerceMessage(body?.message ?? body?.command);

    if (!message) {
      return NextResponse.json(
        { ok: false, reply: "I need a command before I can respond." },
        { status: 400 }
      );
    }

    const routedModel = await resolveModelForChat({
      requestedProviderModel:
        process.env.CLICKY_CHAT_MODEL || DEFAULT_CLICKY_MODEL,
    });

    if (!routedModel.model) {
      return NextResponse.json({
        ok: true,
        reply: buildNoModelConfiguredMessage(),
        aiUnavailable: true,
        modelRoute: routedModel.decision,
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(new Error("Clicky chat timed out."));
    }, CLICKY_CHAT_TIMEOUT_MS);

    const { text } = await generateText({
      model: routedModel.model,
      system: CLICKY_SYSTEM_PROMPT,
      prompt: `User command: ${message}`,
      maxOutputTokens: 180,
      temperature: 0.3,
      abortSignal: controller.signal,
    }).finally(() => {
      clearTimeout(timeoutId);
    });

    const reply = coerceMessage(text) || "I heard you, but I do not have a useful reply yet.";

    return NextResponse.json({
      ok: true,
      reply,
      modelRoute: routedModel.decision,
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
