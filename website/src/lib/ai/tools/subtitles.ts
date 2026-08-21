import { tool } from "ai";
import { z } from "zod";

import { createServerLogger } from "@/lib/server-logger";
import {
  generateSubtitlesFromTranscript,
  type SubtitleCue,
  type SubtitleWordToken,
} from "@/lib/ai/subtitles-generator";
import type { ToolContext } from "../types";

const log = createServerLogger("SubtitlesTool");

const ASSEMBLYAI_TRANSCRIPTION_POLL_ATTEMPTS = 30;
const ASSEMBLYAI_TRANSCRIPTION_POLL_DELAY_MS = 1000;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function transcribeMediaWithAssemblyAI(
  mediaUrl: string,
  language: string
): Promise<{ text: string; words?: SubtitleWordToken[] }> {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    throw new Error("AssemblyAI API key not configured in environment (ASSEMBLYAI_API_KEY).");
  }

  log.info("Submitting AssemblyAI transcription job for subtitle generation", { mediaUrl, language });

  const createRes = await fetch("https://api.assemblyai.com/v2/transcript", {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      audio_url: mediaUrl,
      language_code: language.toLowerCase().slice(0, 2),
      punctuate: true,
      format_text: true,
    }),
  });

  if (!createRes.ok) {
    const errorPayload = await createRes.json().catch(() => ({}));
    throw new Error(
      `AssemblyAI transcript creation failed (${createRes.status}): ${
        (errorPayload as { error?: string })?.error || createRes.statusText
      }`
    );
  }

  const createData = (await createRes.json()) as { id: string };
  const transcriptId = createData.id;

  for (let attempt = 0; attempt < ASSEMBLYAI_TRANSCRIPTION_POLL_ATTEMPTS; attempt += 1) {
    await wait(ASSEMBLYAI_TRANSCRIPTION_POLL_DELAY_MS);
    const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
      headers: { Authorization: apiKey },
    });

    if (!pollRes.ok) {
      throw new Error(`AssemblyAI transcript poll failed (${pollRes.status})`);
    }

    const pollData = (await pollRes.json()) as {
      status: string;
      text?: string;
      words?: Array<{ text: string; start: number; end: number; speaker?: string }>;
      error?: string;
    };

    if (pollData.status === "completed") {
      const words: SubtitleWordToken[] | undefined = pollData.words?.map((w) => ({
        word: w.text,
        startMs: w.start,
        endMs: w.end,
        speaker: w.speaker,
      }));

      return {
        text: pollData.text || "",
        words,
      };
    }

    if (pollData.status === "error") {
      throw new Error(`AssemblyAI transcription error: ${pollData.error || "Unknown error"}`);
    }
  }

  throw new Error("AssemblyAI transcription timed out while generating subtitles.");
}

export const generateSubtitlesInputSchema = z.object({
  mediaUrl: z
    .string()
    .optional()
    .describe("Public media URL or file path to generate subtitles for."),
  transcriptText: z
    .string()
    .optional()
    .describe("Raw transcript text if speech has already been transcribed."),
  outputFormat: z
    .enum(["srt", "vtt", "davinci_script", "all"])
    .default("all")
    .describe("Format of subtitles to generate."),
  maxCharsPerLine: z
    .number()
    .int()
    .min(20)
    .max(60)
    .default(37)
    .describe("Maximum characters allowed per subtitle line (DaVinci Resolve default is 37)."),
  maxLines: z
    .number()
    .int()
    .min(1)
    .max(3)
    .default(2)
    .describe("Maximum number of lines per subtitle card (default: 2)."),
  language: z
    .string()
    .default("en")
    .describe("Language code for speech recognition (e.g. 'en', 'es', 'fr')."),
  targetDaVinciResolve: z
    .boolean()
    .default(true)
    .describe("If true, generates Python automation payload for direct import into DaVinci Resolve."),
});

export type GenerateSubtitlesInput = z.infer<typeof generateSubtitlesInputSchema>;

export function generateSubtitles(ctx: ToolContext) {
  void ctx;

  return tool({
    description:
      "Automatically generate subtitles (.srt, .vtt, DaVinci Resolve script) from media URL, local audio/video file, or raw transcript. Inspired by tmoroney/auto-subs with full DaVinci Resolve timeline sync capability.",
    inputSchema: generateSubtitlesInputSchema,
    execute: async (input: GenerateSubtitlesInput) => {
      const {
        mediaUrl,
        transcriptText,
        outputFormat = "all",
        maxCharsPerLine = 37,
        maxLines = 2,
        language = "en",
        targetDaVinciResolve = true,
      } = input;

      log.info("Generating subtitles", {
        hasMediaUrl: Boolean(mediaUrl),
        hasTranscriptText: Boolean(transcriptText),
        maxCharsPerLine,
        maxLines,
        targetDaVinciResolve,
      });

      let textToUse = transcriptText || "";
      let wordTokens: SubtitleWordToken[] | undefined;
      const transcriptionSource = transcriptText ? "user_provided" : "assemblyai";

      if (!textToUse && mediaUrl) {
        try {
          const res = await transcribeMediaWithAssemblyAI(mediaUrl, language);
          textToUse = res.text;
          wordTokens = res.words;
        } catch (err) {
          log.error("Failed to transcribe media for subtitles:", err);
          return {
            ok: false,
            message:
              err instanceof Error
                ? err.message
                : "Failed to transcribe media for automatic subtitle generation.",
          };
        }
      }

      if (!textToUse.trim()) {
        return {
          ok: false,
          message:
            "Please provide either a valid media URL to transcribe or a transcript text payload.",
        };
      }

      const generated = generateSubtitlesFromTranscript(
        { text: textToUse, wordTokens },
        { maxCharsPerLine, maxLines }
      );

      const totalDurationMs =
        generated.cues.length > 0
          ? generated.cues[generated.cues.length - 1].endTimeMs - generated.cues[0].startTimeMs
          : 0;

      return {
        ok: true,
        title: "Auto Subtitle Generation",
        cueCount: generated.cues.length,
        durationMs: totalDurationMs,
        transcriptionSource,
        maxCharsPerLine,
        maxLines,
        outputFormat,
        srt: outputFormat === "vtt" || outputFormat === "davinci_script" ? undefined : generated.srt,
        vtt: outputFormat === "srt" || outputFormat === "davinci_script" ? undefined : generated.vtt,
        daVinciScript: targetDaVinciResolve ? generated.daVinciScript : undefined,
        previewCues: generated.cues.slice(0, 8),
        fullCues: generated.cues,
        message: `Successfully generated ${generated.cues.length} subtitle cues for ${
          mediaUrl || "provided transcript"
        }. Ready for export to SRT, WebVTT, or direct import into DaVinci Resolve.`,
      };
    },
  });
}
