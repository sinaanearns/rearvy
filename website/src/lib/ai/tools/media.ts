import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import { generateImage, experimental_generateVideo as generateVideo } from "ai";
import { enrichImagePromptWithWebResearch } from "@/lib/ai/image-generation-research";
import {
  MEDIA_ASPECT_RATIOS,
  normalizeMediaAspectRatio,
  withMediaAspectRatioPromptHint,
} from "@/lib/ai/media-aspect-ratio";
import { normalizeGeneratedMediaPrompt } from "@/lib/ai/media-prompt";
import {
  getMediaProviderPreference,
  getImageSizeForAspectRatio,
  getOpenAICompatibleMediaConfigError,
  getOpenAICompatibleMediaRuntimeError,
  normalizeGeneratedMediaUrls,
  resolveOpenAICompatibleMediaProvider,
} from "@/lib/ai/media-provider";
import {
  getNvidiaCosmosVideoConfigError,
  hasNvidiaCosmosVideoConfig,
  submitNvidiaCosmosVideoGeneration,
} from "@/lib/ai/nvidia-cosmos-video";

const mediaAspectRatioSchema = z.enum(MEDIA_ASPECT_RATIOS);
type GeneratedVideoModel = Parameters<typeof generateVideo>[0]["model"];

function normalizeInputImages(value: unknown) {
  const items = Array.isArray(value) ? value : value ? [value] : [];

  return items
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 3);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function resolveVideoModel(client: unknown, model: string): GeneratedVideoModel {
  if (!isRecord(client)) {
    throw new Error("Media provider client is not available for video generation.");
  }

  const videoModelFactory = client.video;
  if (typeof videoModelFactory === "function") {
    return (videoModelFactory as (model: string) => GeneratedVideoModel)(model);
  }

  const chatModelFactory = client.chatModel;
  if (typeof chatModelFactory === "function") {
    return (chatModelFactory as (model: string) => GeneratedVideoModel)(model);
  }

  throw new Error("Media provider does not expose a compatible video model.");
}

function getGeneratedVideoItems(result: unknown): unknown[] {
  if (isRecord(result) && Array.isArray(result.videos)) {
    return result.videos;
  }

  return Array.isArray(result) ? result : [result];
}

export function generateMedia(ctx: ToolContext) {
  void ctx;
  return tool({
    description: "Generate an image or video based on a descriptive text prompt, or edit supplied images. Use 'image' for static visuals, 'image-edit' when inputImages are supplied, and 'video' for short animations. Qwen image editing and Cosmos video can use NVIDIA when configured. Omit aspectRatio to use Instagram post format for images and landscape format for videos.",
    inputSchema: z.object({
      mode: z.enum(["image", "image-edit", "video"]).describe("The type of media to generate or edit."),
      prompt: z.string().describe("The user's visual prompt. Preserve the subject and constraints; do not rewrite it as a design brief, product spec, or description of a prompt."),
      aspectRatio: mediaAspectRatioSchema.optional().describe("The aspect ratio for the generated media. Use 4:5 for Instagram posts, 16:9 for YouTube, 9:16 for stories/reels, and 21:9 for cinematic images."),
      inputImages: z.array(z.string()).max(3).optional().describe("Image URLs or data URLs to edit. Required for image-edit."),
    }),
    execute: async ({ mode, prompt, aspectRatio, inputImages }) => {
      const normalizedInputImages = normalizeInputImages(inputImages);
      const effectiveMode =
        mode === "image-edit" || normalizedInputImages.length > 0
          ? "image-edit"
          : mode;
      const aspectRatioMode = effectiveMode === "video" ? "video" : "image";
      const normalizedPrompt = normalizeGeneratedMediaPrompt(
        prompt,
        effectiveMode
      );
      const selectedAspectRatio = normalizeMediaAspectRatio(
        aspectRatio,
        aspectRatioMode
      );
      const shouldUseNvidiaCosmosVideo =
        effectiveMode === "video" &&
        getMediaProviderPreference("video") === "nvidia";

      try {
        if (shouldUseNvidiaCosmosVideo) {
          if (!hasNvidiaCosmosVideoConfig()) {
            return {
              ok: false,
              mode: effectiveMode,
              prompt: normalizedPrompt,
              aspectRatio: selectedAspectRatio,
              message: getNvidiaCosmosVideoConfigError(),
            };
          }

          const result = await submitNvidiaCosmosVideoGeneration({
            prompt: normalizedPrompt,
            aspectRatio: selectedAspectRatio,
          });

          return {
            ok: result.status !== "failed",
            provider: "nvidia",
            mode: "video",
            prompt: normalizedPrompt,
            aspectRatio: selectedAspectRatio,
            model: result.model,
            status: result.status,
            videos: result.videos,
            message: "Video generation completed with NVIDIA Cosmos.",
          };
        }

        const mediaProvider = resolveOpenAICompatibleMediaProvider(effectiveMode);

        if (!mediaProvider) {
          return {
            ok: false,
            mode: effectiveMode,
            prompt: normalizedPrompt,
            aspectRatio: selectedAspectRatio,
            message: getOpenAICompatibleMediaConfigError(effectiveMode),
          };
        }

        if (effectiveMode === "image" || effectiveMode === "image-edit") {
          if (effectiveMode === "image-edit" && normalizedInputImages.length === 0) {
            return {
              ok: false,
              mode: effectiveMode,
              prompt: normalizedPrompt,
              aspectRatio: selectedAspectRatio,
              message: "Image editing requires at least one input image.",
            };
          }

          const researchedPrompt =
            effectiveMode === "image"
              ? await enrichImagePromptWithWebResearch(normalizedPrompt)
              : { prompt: normalizedPrompt };
          const selectedModel = mediaProvider.client.imageModel(
            mediaProvider.model
          );

          const result = await generateImage({
            model: selectedModel,
            prompt:
              effectiveMode === "image-edit"
                ? {
                    text: withMediaAspectRatioPromptHint(
                      researchedPrompt.prompt,
                      selectedAspectRatio
                    ),
                    images: normalizedInputImages,
                  }
                : withMediaAspectRatioPromptHint(
                    researchedPrompt.prompt,
                    selectedAspectRatio
                  ),
            size: getImageSizeForAspectRatio(selectedAspectRatio),
          }).catch((error) => {
            throw new Error(
              getOpenAICompatibleMediaRuntimeError(
                error,
                mediaProvider.name,
                effectiveMode
              )
            );
          });

          const images = normalizeGeneratedMediaUrls(result.images, "image/png");

          return {
            ok: true,
            provider: mediaProvider.name,
            mode: effectiveMode,
            prompt: normalizedPrompt,
            aspectRatio: selectedAspectRatio,
            model: mediaProvider.model,
            images,
            usage: result.usage,
            message:
              effectiveMode === "image-edit"
                ? "Image edit completed with NVIDIA Qwen."
                : "Image generation completed.",
          };
        } else {
          const selectedModel = resolveVideoModel(
            mediaProvider.client,
            mediaProvider.model
          );

          const result = await generateVideo({
            model: selectedModel,
            prompt: normalizedPrompt,
            aspectRatio: selectedAspectRatio,
          });

          const videos = normalizeGeneratedMediaUrls(
            getGeneratedVideoItems(result),
            "video/mp4"
          );

          return {
            ok: true,
            provider: mediaProvider.name,
            mode: "video",
            prompt: normalizedPrompt,
            aspectRatio: selectedAspectRatio,
            model: mediaProvider.model,
            videos,
          };
        }
      } catch (error) {
        console.error("Media generation tool error:", error);
        return {
          ok: false,
          mode: effectiveMode,
          prompt: normalizedPrompt,
          aspectRatio: selectedAspectRatio,
          message: error instanceof Error ? error.message : "Failed to generate media.",
        };
      }
    },
  });
}
