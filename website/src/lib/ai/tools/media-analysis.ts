import { tool } from "ai";
import { z } from "zod";

import {
  aiCompletionService,
  sanitizeModelRouteForClient,
} from "@/lib/ai/model-router";
import {
  type MediaAnalysisTask,
  type MediaAnalysisType,
  inferMediaAnalysisType,
} from "@/lib/ai/media-analysis-intent";
import { normalizeHttpUrl } from "@/lib/chat/url-normalization";
import { createServerLogger } from "@/lib/server-logger";
import type { ToolContext } from "../types";
import { performWebPageFetch } from "./web";

const log = createServerLogger("MediaAnalysisTool");

const MEDIA_ANALYSIS_TYPES = ["auto", "youtube", "video", "audio", "page"] as const;
const MEDIA_ANALYSIS_TASKS = ["analyze", "summarize", "transcribe"] as const;
const RAW_MEDIA_EXTENSION_PATTERN = /\.(?:mp3|m4a|wav|aac|ogg|oga|flac|mp4|mov|webm|mkv|avi|m4v)(?:[?#]|$)/i;
const ASSEMBLYAI_TRANSCRIPTION_POLL_ATTEMPTS = 30;
const ASSEMBLYAI_TRANSCRIPTION_POLL_DELAY_MS = 1000;
const DEFAULT_ASSEMBLYAI_SPEECH_MODELS = ["universal-3-pro", "universal-2"];

export type MediaAnalysisToolInput = {
  url: string;
  task?: MediaAnalysisTask;
  mediaType?: MediaAnalysisType;
  prompt?: string;
};

type EmbedMetadata = {
  title?: string;
  authorName?: string;
  providerName?: string;
  thumbnailUrl?: string;
};

type PageEvidence = {
  ok: boolean;
  title: string | null;
  url: string;
  source?: string;
  fetchMethod?: string;
  content: string;
  message?: string;
};

type AssemblyTranscriptResult = {
  id?: string;
  status?: string;
  text?: string;
  error?: string;
};

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function extractYouTubeVideoId(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./i, "");

    if (host === "youtu.be") {
      return parsed.pathname.split("/").filter(Boolean)[0] ?? null;
    }

    if (host.endsWith("youtube.com")) {
      return (
        parsed.searchParams.get("v") ||
        parsed.pathname.match(/\/(?:shorts|embed|live)\/([^/?#]+)/i)?.[1] ||
        null
      );
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeTask(value: MediaAnalysisTask | undefined): MediaAnalysisTask {
  return MEDIA_ANALYSIS_TASKS.includes(value as MediaAnalysisTask)
    ? (value as MediaAnalysisTask)
    : "analyze";
}

function normalizeRequestedType(value: MediaAnalysisType | undefined): MediaAnalysisType {
  return MEDIA_ANALYSIS_TYPES.includes(value as MediaAnalysisType)
    ? (value as MediaAnalysisType)
    : "auto";
}

export function normalizePublicMediaUrl(value: string) {
  return normalizeHttpUrl(value);
}

function resolveMediaType(
  url: string,
  requestedType: MediaAnalysisType | undefined,
  prompt: string | undefined
): Exclude<MediaAnalysisType, "auto"> {
  const normalized = normalizeRequestedType(requestedType);
  if (normalized !== "auto") {
    return normalized;
  }

  return inferMediaAnalysisType(url, prompt) === "auto"
    ? "page"
    : (inferMediaAnalysisType(url, prompt) as Exclude<MediaAnalysisType, "auto">);
}

function shouldFetchReadablePage(url: string, mediaType: MediaAnalysisType) {
  return mediaType === "page" || mediaType === "youtube" || !RAW_MEDIA_EXTENSION_PATTERN.test(url);
}

export function shouldAttemptAssemblyUrlTranscription(params: {
  task: MediaAnalysisTask;
  mediaType: MediaAnalysisType;
  url: string;
}) {
  return (
    params.task === "transcribe" &&
    (params.mediaType === "audio" || params.mediaType === "video") &&
    RAW_MEDIA_EXTENSION_PATTERN.test(params.url)
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveAssemblySpeechModels() {
  const configured = String(process.env.ASSEMBLYAI_SPEECH_MODELS || "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);

  return configured.length > 0 ? configured : DEFAULT_ASSEMBLYAI_SPEECH_MODELS;
}

async function readAssemblyJson(response: Response) {
  return response.json().catch(async () => {
    const text = await response.text().catch(() => "");
    return text ? { error: text.slice(0, 500) } : {};
  }) as Promise<unknown>;
}

async function transcribePublicMediaUrl(url: string) {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false as const,
      code: "assemblyai_key_missing",
      message:
        "AssemblyAI is not configured for public media URL transcription.",
    };
  }

  const createResponse = await fetch("https://api.assemblyai.com/v2/transcript", {
    method: "POST",
    headers: {
      authorization: apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      audio_url: url,
      speech_models: resolveAssemblySpeechModels(),
    }),
  });
  const createJson = await readAssemblyJson(createResponse);

  if (!createResponse.ok || !isRecord(createJson) || typeof createJson.id !== "string") {
    return {
      ok: false as const,
      code: "assemblyai_transcript_create_failed",
      message:
        isRecord(createJson) && typeof createJson.error === "string"
          ? createJson.error.slice(0, 500)
          : "Failed to create an AssemblyAI transcript job.",
    };
  }

  const transcriptId = createJson.id;
  for (let attempt = 0; attempt < ASSEMBLYAI_TRANSCRIPTION_POLL_ATTEMPTS; attempt += 1) {
    await wait(ASSEMBLYAI_TRANSCRIPTION_POLL_DELAY_MS);
    const response = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
      headers: { authorization: apiKey },
    });
    const json = await readAssemblyJson(response);
    const transcript = isRecord(json) ? (json as AssemblyTranscriptResult) : null;

    if (!response.ok) {
      return {
        ok: false as const,
        code: "assemblyai_transcript_poll_failed",
        message:
          typeof transcript?.error === "string"
            ? transcript.error.slice(0, 500)
            : "Failed to poll the AssemblyAI transcript job.",
        transcriptId,
      };
    }

    if (transcript?.status === "completed") {
      return {
        ok: true as const,
        transcriptId,
        text: String(transcript.text || "").trim(),
      };
    }

    if (transcript?.status === "error") {
      return {
        ok: false as const,
        code: "assemblyai_transcript_error",
        message:
          typeof transcript.error === "string"
            ? transcript.error.slice(0, 500)
            : "AssemblyAI could not transcribe this media URL.",
        transcriptId,
      };
    }
  }

  return {
    ok: false as const,
    code: "assemblyai_transcript_timeout",
    message: "AssemblyAI transcription did not finish before the chat timeout.",
    transcriptId,
  };
}

async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; RearvyBot/1.0; +https://rearvy.com)",
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`Metadata request failed with status ${response.status}.`);
  }

  return response.json() as Promise<unknown>;
}

async function fetchEmbedMetadata(url: string, mediaType: MediaAnalysisType) {
  const candidates: string[] = [];

  if (mediaType === "youtube") {
    candidates.push(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`
    );
  }

  candidates.push(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);

  for (const candidate of candidates) {
    try {
      const json = await fetchJson(candidate);
      if (!isRecord(json)) {
        continue;
      }

      const metadata: EmbedMetadata = {
        title: readString(json.title),
        authorName: readString(json.author_name),
        providerName: readString(json.provider_name),
        thumbnailUrl: readString(json.thumbnail_url),
      };

      if (metadata.title || metadata.authorName || metadata.providerName) {
        return metadata;
      }
    } catch {
      // Metadata is optional. Continue with page evidence when available.
    }
  }

  return null;
}

export function buildMediaAnalysisFallbackSummary(params: {
  task: MediaAnalysisTask;
  mediaType: MediaAnalysisType;
  prompt?: string;
  metadata?: EmbedMetadata | null;
  page?: PageEvidence | null;
  transcript?: string;
}) {
  const { task, mediaType, prompt, metadata, page, transcript } = params;
  const title = metadata?.title || page?.title || "Untitled media link";
  const provider = metadata?.providerName || page?.source || mediaType;
  const pagePreview = page?.content
    ? page.content.replace(/\s+/g, " ").trim().slice(0, 500)
    : "";
  const transcriptPreview = transcript
    ? transcript.replace(/\s+/g, " ").trim().slice(0, 700)
    : "";
  const lines = [
    `Source: ${title}${provider ? ` (${provider})` : ""}.`,
    prompt ? `Request: ${prompt}` : "",
    transcriptPreview ? `Transcript excerpt: ${transcriptPreview}` : "",
    pagePreview ? `Readable context: ${pagePreview}` : "",
  ].filter(Boolean);

  if (task === "transcribe" && !transcriptPreview) {
    lines.push(
      "A verified transcript was not available from the public page evidence."
    );
  }

  return lines.join("\n\n") || "No readable media evidence was available.";
}

function transcriptAvailableFromPage(page: PageEvidence | null) {
  if (!page?.content) {
    return false;
  }

  return /\b(?:transcript|captions?|subtitles?)\b/i.test(page.content);
}

function buildAnalysisPrompt(params: {
  task: MediaAnalysisTask;
  mediaType: MediaAnalysisType;
  url: string;
  prompt: string;
  metadata: EmbedMetadata | null;
  page: PageEvidence | null;
  transcript: string;
}) {
  const { task, mediaType, url, prompt, metadata, page, transcript } = params;
  const evidence = [
    metadata?.title ? `Title: ${metadata.title}` : "",
    metadata?.authorName ? `Author/channel: ${metadata.authorName}` : "",
    metadata?.providerName ? `Provider: ${metadata.providerName}` : "",
    page?.title ? `Page title: ${page.title}` : "",
    page?.source ? `Source host: ${page.source}` : "",
    transcript ? `Verified transcript:\n${transcript.slice(0, 12000)}` : "",
    page?.content ? `Readable page content:\n${page.content.slice(0, 9000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return `Analyze this public media/page link using only the evidence below.

Task: ${task}
Media type: ${mediaType}
URL: ${url}
User request: ${prompt || "Analyze this media link."}

Evidence:
${evidence || "No readable metadata or page text was available."}

Return a concise answer with:
- What the source appears to be
- The most useful summary or analysis supported by the evidence
- Any limitations, especially if no transcript is available

Do not invent audio, video, or transcript content that is not present in the evidence.`;
}

export function analyzeMedia(ctx: ToolContext) {
  return tool({
    description:
      "Analyze, summarize, or inspect a public media URL such as YouTube, video, audio, podcast, webinar, or media page. Use this for public media link analysis. For direct public audio/video file URLs, transcribe with AssemblyAI when configured. If the user asks for transcription and no transcript is available, explain that YouTube/page transcription requires the desktop Maria bridge or a supplied transcript.",
    inputSchema: z.object({
      url: z
        .string()
        .url()
        .refine((value) => normalizePublicMediaUrl(value) !== null, {
          message: "Media analysis URLs must use http or https.",
        })
        .describe("The public http/https media or page URL to analyze."),
      task: z
        .enum(MEDIA_ANALYSIS_TASKS)
        .optional()
        .default("analyze")
        .describe("Whether to analyze, summarize, or transcribe the media link."),
      mediaType: z
        .enum(MEDIA_ANALYSIS_TYPES)
        .optional()
        .default("auto")
        .describe("Known media type, or auto to infer from the URL and prompt."),
      prompt: z
        .string()
        .optional()
        .describe("The user's specific analysis request."),
    }),
    execute: async (rawInput): Promise<Record<string, unknown>> => {
      const mediaUrl = normalizePublicMediaUrl(rawInput.url);
      if (!mediaUrl) {
        return {
          ok: false,
          task: normalizeTask(rawInput.task),
          mediaType: normalizeRequestedType(rawInput.mediaType),
          url: rawInput.url,
          message: "Media analysis requires a public http or https URL.",
        };
      }

      const task = normalizeTask(rawInput.task);
      const mediaType = resolveMediaType(
        mediaUrl,
        rawInput.mediaType,
        rawInput.prompt
      );
      const prompt = rawInput.prompt?.trim() || `${task} this media link`;
      const youtubeVideoId =
        mediaType === "youtube" ? extractYouTubeVideoId(mediaUrl) : null;

      let metadata: EmbedMetadata | null = null;
      let page: PageEvidence | null = null;
      let transcript = "";
      let transcriptProvider: string | undefined;
      let transcriptJobId: string | undefined;
      let transcriptErrorCode: string | undefined;
      let transcriptErrorMessage: string | undefined;

      try {
        const [metadataResult, pageResult] = await Promise.all([
          fetchEmbedMetadata(mediaUrl, mediaType),
          shouldFetchReadablePage(mediaUrl, mediaType)
            ? performWebPageFetch(mediaUrl, 10_000)
            : Promise.resolve(null),
        ]);

        metadata = metadataResult;
        page = pageResult
          ? {
              ok: pageResult.ok,
              title: pageResult.title,
              url: pageResult.url,
              source: pageResult.source,
              fetchMethod: pageResult.fetchMethod,
              content: pageResult.content,
              message: pageResult.message,
            }
          : null;
      } catch (error) {
        log.warn("Optional media evidence fetch failed:", error);
      }

      if (
        shouldAttemptAssemblyUrlTranscription({
          task,
          mediaType,
          url: mediaUrl,
        })
      ) {
        try {
          const transcriptResult = await transcribePublicMediaUrl(mediaUrl);
          if (transcriptResult.ok) {
            transcript = transcriptResult.text.slice(0, 20_000);
            transcriptProvider = "assemblyai";
            transcriptJobId = transcriptResult.transcriptId;
          } else {
            transcriptErrorCode = transcriptResult.code;
            transcriptErrorMessage = transcriptResult.message;
            transcriptJobId = transcriptResult.transcriptId;
          }
        } catch (error) {
          transcriptErrorCode = "assemblyai_network_error";
          transcriptErrorMessage =
            error instanceof Error
              ? error.message
              : "AssemblyAI transcription failed unexpectedly.";
        }
      }

      const hasTranscript = Boolean(transcript) || transcriptAvailableFromPage(page);
      const hasEvidence = Boolean(
        transcript || metadata?.title || metadata?.authorName || page?.content || page?.title
      );
      const transcriptionStatus =
        task === "transcribe"
          ? hasTranscript
            ? transcriptProvider === "assemblyai"
              ? "transcribed_with_assemblyai"
              : "transcript_context_available"
            : "requires_desktop_bridge"
          : "not_requested";

      if (!hasEvidence) {
        return {
          ok: false,
          task,
          mediaType,
          url: mediaUrl,
          youtubeVideoId,
          transcriptAvailable: false,
          transcriptionStatus,
          transcriptErrorCode,
          transcriptErrorMessage,
          message:
            task === "transcribe" && transcriptErrorMessage
              ? `${transcriptErrorMessage} Use Rearvy Desktop Maria/AssemblyAI or provide a transcript if this URL cannot be transcribed directly.`
              : task === "transcribe"
              ? "I could not find a public transcript or readable page evidence. Raw audio/video transcription needs the Rearvy desktop Maria/AssemblyAI bridge or a pasted transcript."
              : "I could not find readable public evidence for this media link.",
        };
      }

      const fallbackSummary = buildMediaAnalysisFallbackSummary({
        task,
        mediaType,
        prompt,
        metadata,
        page,
        transcript,
      });

      try {
        const result = await aiCompletionService.generateText({
          task: "deep_business_reasoning",
          requestedProviderModel:
            process.env.MEDIA_ANALYSIS_MODEL ||
            ctx.chatProviderModel ||
            undefined,
          system: [
            "You are Rearvy's media analyst.",
            "Use only provided public metadata, readable page evidence, and verified transcript evidence.",
            "Do not claim you watched, heard, or transcribed media unless transcript evidence is present.",
            "Be concise and practical.",
          ].join("\n"),
          prompt: buildAnalysisPrompt({
            task,
            mediaType,
            url: mediaUrl,
            prompt,
            metadata,
            page,
            transcript,
          }),
          userId: ctx.userId,
          projectId: ctx.projectId ?? null,
          chatId: ctx.chatId ?? null,
          maxOutputTokens: 1200,
          temperature: 0.25,
          timeoutMs: 45_000,
        });

        return {
          ok: true,
          task,
          mediaType,
          url: mediaUrl,
          youtubeVideoId,
          title: metadata?.title || page?.title || undefined,
          source: metadata?.providerName || page?.source || undefined,
          authorName: metadata?.authorName,
          thumbnailUrl: metadata?.thumbnailUrl,
          transcriptAvailable: hasTranscript,
          transcriptionStatus,
          transcript,
          summary: result.aiUnavailable ? fallbackSummary : result.text,
          message:
            task === "transcribe" && transcriptProvider === "assemblyai"
              ? "Transcription completed with AssemblyAI from the public media URL."
              : task === "transcribe" && !hasTranscript
              ? "I summarized the public metadata/page evidence, but a verified transcript was not available. Use Rearvy Desktop Maria/AssemblyAI or provide a transcript for real transcription."
              : "Media analysis completed from public evidence.",
          transcriptProvider,
          transcriptJobId,
          transcriptErrorCode,
          transcriptErrorMessage,
          evidence: {
            pageFetched: page?.ok === true,
            fetchMethod: page?.fetchMethod,
            pageTitle: page?.title,
            source: page?.source,
          },
          modelRoute: result.aiUnavailable
            ? undefined
            : sanitizeModelRouteForClient(result.modelRoute),
          aiUnavailable: result.aiUnavailable || undefined,
        };
      } catch (error) {
        log.error("Media analysis failed:", error);
        return {
          ok: true,
          task,
          mediaType,
          url: mediaUrl,
          youtubeVideoId,
          title: metadata?.title || page?.title || undefined,
          source: metadata?.providerName || page?.source || undefined,
          authorName: metadata?.authorName,
          thumbnailUrl: metadata?.thumbnailUrl,
          transcriptAvailable: hasTranscript,
          transcriptionStatus,
          transcript,
          summary: fallbackSummary,
          message:
            task === "transcribe" && transcriptProvider === "assemblyai"
              ? "Transcription completed with AssemblyAI from the public media URL, then analysis fell back to transcript evidence because model summarization failed."
              : "Media analysis fell back to public metadata/page evidence because model summarization failed.",
          transcriptProvider,
          transcriptJobId,
          transcriptErrorCode,
          transcriptErrorMessage,
        };
      }
    },
  });
}
