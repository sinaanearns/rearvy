import { z } from "zod";
import { aiCompletionService, sanitizeModelRouteForClient } from "@/lib/ai/model-router";

const MAX_REFERENCE_FRAMES = 8;
const MAX_FRAME_CHARS = 8_000_000;
const MAX_TOTAL_FRAME_CHARS = 24_000_000;

export const ContentRecreationShotSchema = z.object({
  sceneIndex: z.number().int().min(1),
  timestamp: z.string().trim().min(1).max(40),
  durationSeconds: z.number().min(0.5).max(60),
  visualDescription: z.string().trim().min(1).max(1200),
  inspirationNotes: z.string().trim().min(1).max(800),
  suggestedPrompt: z.string().trim().min(1).max(1600),
  onScreenText: z.string().trim().max(240).default(""),
  cameraAngle: z.string().trim().min(1).max(400),
  motionPlan: z.string().trim().min(1).max(800),
  fusionPlan: z.string().trim().max(1000).default(""),
  moodAndColor: z.string().trim().min(1).max(500),
  audioDirection: z.string().trim().max(500).default(""),
});

export const ContentRecreationPlanSchema = z.object({
  topic: z.string().trim().min(1).max(240),
  targetNiche: z.string().trim().min(1).max(240),
  assumptions: z.array(z.string().trim().min(1).max(300)).min(1).max(8),
  confidenceScore: z.number().min(0).max(1),
  sourceUsePolicy: z.object({
    mode: z.enum(["reference_only", "owned_or_licensed_assets"]),
    notes: z.string().trim().min(1).max(700),
  }),
  overallStyle: z.string().trim().min(1).max(700),
  pinterestSearchQueries: z.array(z.string().trim().min(1).max(120)).min(1).max(8),
  shots: z.array(ContentRecreationShotSchema).min(1).max(24),
  davinciResolvePlan: z.object({
    timelineName: z.string().trim().min(1).max(120),
    fps: z.number().int().min(24).max(60).default(30),
    aspectRatio: z.enum(["9:16", "16:9", "1:1", "4:5"]).default("9:16"),
    resolution: z.string().trim().min(1).max(30).default("1080x1920"),
    editSteps: z.array(z.string().trim().min(1).max(300)).min(1).max(24),
  }),
});

export type ContentRecreationShot = z.infer<typeof ContentRecreationShotSchema>;
export type ContentRecreationPlan = z.infer<typeof ContentRecreationPlanSchema>;

export type ReferenceFrameInput = {
  data: string;
  mediaType?: string;
};

export type CreateContentRecreationPlanInput = {
  topic: string;
  targetNiche?: string;
  referenceUrl?: string;
  sourceUseMode?: "reference_only" | "owned_or_licensed_assets";
  frames?: string[];
  desiredDurationSeconds?: number;
  aspectRatio?: "9:16" | "16:9" | "1:1" | "4:5";
};

const DATA_IMAGE_PATTERN = /^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=\s]+$/i;
const RAW_BASE64_PATTERN = /^[a-z0-9+/=\s]+$/i;

function cleanString(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 240) : fallback;
}

export function normalizeReferenceFrames(frames: unknown): string[] {
  if (!Array.isArray(frames)) {
    return [];
  }

  const normalized: string[] = [];
  let totalChars = 0;

  for (const frame of frames) {
    if (typeof frame !== "string") {
      continue;
    }

    const trimmed = frame.trim();
    if (!trimmed || trimmed.length > MAX_FRAME_CHARS) {
      continue;
    }

    const isValidDataUrl = DATA_IMAGE_PATTERN.test(trimmed);
    const isValidRawBase64 = RAW_BASE64_PATTERN.test(trimmed);
    if (!isValidDataUrl && !isValidRawBase64) {
      continue;
    }

    const normalizedFrame = isValidDataUrl
      ? trimmed
      : `data:image/png;base64,${trimmed.replace(/\s+/g, "")}`;

    totalChars += normalizedFrame.length;
    if (totalChars > MAX_TOTAL_FRAME_CHARS) {
      break;
    }

    normalized.push(normalizedFrame);
    if (normalized.length >= MAX_REFERENCE_FRAMES) {
      break;
    }
  }

  return normalized;
}

function buildPlannerSystemPrompt() {
  return [
    "You are Rearvy's senior creative director for short-form video production.",
    "Break reference material into an original, editable production plan for DaVinci Resolve.",
    "Use reference material for structure, pacing, camera language, and visual inspiration only unless sourceUsePolicy is owned_or_licensed_assets.",
    "Return only structured data matching the schema.",
    "Each shot must include concrete image-generation prompts, Resolve editing actions, camera/motion notes, Fusion notes when useful, and audio direction.",
    "Do not invent downloaded file paths. Do not claim assets exist unless the prompt asks for generated assets.",
  ].join("\n");
}

function buildPlannerPrompt(input: CreateContentRecreationPlanInput) {
  const desiredDuration = Number.isFinite(input.desiredDurationSeconds)
    ? `${input.desiredDurationSeconds} seconds`
    : "20 to 45 seconds";

  return [
    `Topic: ${cleanString(input.topic, "Business video")}`,
    `Target niche: ${cleanString(input.targetNiche, "SaaS / Technology")}`,
    `Reference URL: ${input.referenceUrl?.trim() || "none"}`,
    `Source use mode: ${input.sourceUseMode ?? "reference_only"}`,
    `Desired duration: ${desiredDuration}`,
    `Aspect ratio: ${input.aspectRatio ?? "9:16"}`,
    `Reference frames supplied: ${normalizeReferenceFrames(input.frames).length}`,
    "",
    "Create a human-style production plan:",
    "1. overall style and assumptions",
    "2. Pinterest search queries for similar visual inspiration",
    "3. shot-by-shot breakdown",
    "4. individual image prompts",
    "5. DaVinci Resolve timeline/edit/Fusion instructions",
  ].join("\n");
}

export async function createContentRecreationPlan(
  input: CreateContentRecreationPlanInput
) {
  const frames = normalizeReferenceFrames(input.frames);
  const topic = cleanString(input.topic, "Business video");
  const targetNiche = cleanString(input.targetNiche, "SaaS / Technology");
  const sourceUseMode = input.sourceUseMode ?? "reference_only";

  const userContent: Array<
    | { type: "text"; text: string }
    | { type: "image"; image: string }
  > = [
    {
      type: "text",
      text: buildPlannerPrompt({
        ...input,
        topic,
        targetNiche,
        sourceUseMode,
        frames,
      }),
    },
    ...frames.map((frame) => ({ type: "image" as const, image: frame })),
  ];

  const result = await aiCompletionService.generateObject({
    task: frames.length > 0 ? "screen_analysis" : "workflow_reasoning",
    requestedProviderModel:
      frames.length > 0
        ? process.env.NVIDIA_VISION_MODEL
        : process.env.NVIDIA_WORKFLOW_MODEL,
    hasImageInput: frames.length > 0,
    schema: ContentRecreationPlanSchema,
    system: buildPlannerSystemPrompt(),
    messages: [
      {
        role: "user",
        content: userContent,
      },
    ],
    maxOutputTokens: 4096,
    temperature: 0.2,
    timeoutMs: 60_000,
  });

  return {
    plan: result.object,
    modelRoute: sanitizeModelRouteForClient(result.modelRoute),
  };
}
