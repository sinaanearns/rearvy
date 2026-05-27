import { NextResponse, type NextRequest } from "next/server";
import {
  aiCompletionService,
  sanitizeModelRouteForClient,
} from "@/lib/ai/model-router";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import {
  processVoiceTranscript,
  type ClickyVoiceActiveContext,
  type ClickyVoiceMode,
} from "@/lib/clicky/voice-core";
import {
  getVoiceContext,
  recordVoiceUsage,
} from "@/lib/clicky/voice-store";

export const runtime = "nodejs";

const MAX_TRANSCRIPT_LENGTH = 12_000;
const MAX_SELECTION_WORDS = 1000;

function readString(value: unknown, fallback = "", maxLength = MAX_TRANSCRIPT_LENGTH) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : fallback;
}

function readMode(value: unknown): ClickyVoiceMode {
  return value === "command" ? "command" : "dictation";
}

function readActiveContext(value: unknown): ClickyVoiceActiveContext | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  return {
    appName: readString(record.appName, "", 160) || null,
    title: readString(record.title, "", 300) || null,
    url: readString(record.url, "", 500) || null,
    category:
      record.category === "email" ||
      record.category === "chat" ||
      record.category === "docs" ||
      record.category === "code" ||
      record.category === "terminal" ||
      record.category === "browser"
        ? record.category
        : null,
    workspacePath: readString(record.workspacePath, "", 1000) || null,
    workspaceFiles: Array.isArray(record.workspaceFiles)
      ? record.workspaceFiles
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 250)
      : [],
  };
}

function countWords(value: string) {
  return value.split(/\s+/).filter(Boolean).length;
}

function parseAiText(value: string) {
  const cleaned = value.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as { text?: unknown };
    return typeof parsed.text === "string" ? parsed.text.trim() : "";
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
      return cleaned.trim();
    }
    try {
      const parsed = JSON.parse(match[0]) as { text?: unknown };
      return typeof parsed.text === "string" ? parsed.text.trim() : "";
    } catch {
      return cleaned.trim();
    }
  }
}

function buildAiPrompt(params: {
  mode: ClickyVoiceMode;
  transcript: string;
  deterministicText: string;
  selectedText: string;
  activeContext: ClickyVoiceActiveContext | null;
  styleInstructions: string;
}) {
  if (params.mode === "command") {
    return `You are Clicky's command-mode editor. Transform the selected text if provided; otherwise answer inline at the cursor.
Return exactly JSON: {"text":"..."}.
Do not include markdown fences.

Spoken command:
${params.transcript}

Selected text:
${params.selectedText || "(none)"}

Active app:
${params.activeContext?.appName || "unknown"} - ${params.activeContext?.title || ""}

Style:
${params.styleInstructions || "Clear, concise writing."}`;
  }

  return `You are Clicky's desktop dictation cleanup pass. Improve only clarity, punctuation, casing, paragraph/list formatting, and obvious spoken corrections.
Preserve the user's meaning, technical terms, file tags, code, commands, URLs, names, and snippets exactly.
Return exactly JSON: {"text":"..."}.
Do not include markdown fences.

Raw transcript:
${params.transcript}

Deterministic cleanup:
${params.deterministicText}

Active app:
${params.activeContext?.appName || "unknown"} - ${params.activeContext?.title || ""}

Style:
${params.styleInstructions || "Natural, polished writing."}`;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json().catch(() => ({}));
    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const transcript = readString(record.transcript || record.text);
    const mode = readMode(record.mode);
    const selectedText = readString(record.selectedText, "", 50_000);
    const activeContext = readActiveContext(record.activeContext);
    const durationMs = Number(record.durationMs);

    if (!transcript) {
      return NextResponse.json({ error: "Transcript is required." }, { status: 400 });
    }

    if (mode === "command" && selectedText && countWords(selectedText) > MAX_SELECTION_WORDS) {
      return NextResponse.json(
        { error: "Command mode selections must be under 1,000 words." },
        { status: 400 }
      );
    }

    const context = await getVoiceContext(adminDb, auth.user.uid);
    const deterministic = processVoiceTranscript({
      transcript,
      mode,
      command: transcript,
      selectedText,
      profile: context.profile,
      dictionary: context.dictionary,
      snippets: context.snippets,
      styles: context.styles,
      activeContext,
    });

    const style = context.styles.find((candidate) => candidate.id === deterministic.styleId);
    let finalText = deterministic.text;
    let modelRoute: unknown = null;
    let aiUnavailable = false;

    try {
      const aiResult = await aiCompletionService.generateText({
        task: deterministic.category === "email" ? "email_draft" : "chat_assistant",
        system:
          "You are a precision text editor for a Windows desktop dictation app. Return JSON only and never invent actions.",
        prompt: buildAiPrompt({
          mode,
          transcript,
          deterministicText: deterministic.text,
          selectedText,
          activeContext,
          styleInstructions: style?.instructions || "",
        }),
        userId: auth.user.uid,
        timeoutMs: 18_000,
        maxOutputTokens: 1400,
        temperature: 0.2,
      });
      modelRoute = sanitizeModelRouteForClient(aiResult.modelRoute);
      aiUnavailable = Boolean(aiResult.aiUnavailable);
      if (!aiUnavailable) {
        const parsedText = parseAiText(aiResult.text);
        if (parsedText) {
          finalText = parsedText;
        }
      }
    } catch (error) {
      console.warn("Clicky voice AI cleanup failed; using deterministic output:", error);
      aiUnavailable = true;
    }

    const retainedTranscript =
      context.profile.retentionMode === "transcripts"
        ? { transcript, output: finalText }
        : context.profile.retentionMode === "metadata"
          ? { transcriptLength: transcript.length, outputLength: finalText.length }
          : null;

    await recordVoiceUsage(adminDb, auth.user.uid, {
      mode,
      text: finalText,
      wordCount: countWords(finalText),
      durationMs: Number.isFinite(durationMs) ? durationMs : 0,
      appName: activeContext?.appName || "Unknown app",
      category: deterministic.category,
      retainedTranscript,
      metadata: {
        requestId: readString(record.requestId, "", 120),
        pressEnter: deterministic.pressEnter,
        replaceSelection: deterministic.replaceSelection,
        appliedDictionaryIds: deterministic.appliedDictionaryIds,
        appliedSnippetIds: deterministic.appliedSnippetIds,
        appliedFileTags: deterministic.appliedFileTags,
      },
    });

    return NextResponse.json({
      ok: true,
      text: finalText,
      mode,
      pressEnter: deterministic.pressEnter,
      replaceSelection: deterministic.replaceSelection,
      category: deterministic.category,
      action: {
        type: deterministic.replaceSelection ? "replace-selection" : "insert",
        pressEnter: deterministic.pressEnter,
      },
      appliedDictionaryIds: deterministic.appliedDictionaryIds,
      appliedSnippetIds: deterministic.appliedSnippetIds,
      appliedFileTags: deterministic.appliedFileTags,
      aiUnavailable,
      modelRoute,
    });
  } catch (error) {
    console.error("Failed to process Clicky voice transcript:", error);
    return NextResponse.json({ error: "Failed to process voice transcript." }, { status: 500 });
  }
}
