import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import { generateImage, experimental_generateVideo as generateVideo } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  hasCloudflareMediaConfig,
  submitCloudflareImageGeneration,
  submitCloudflareVideoGeneration,
} from "@/lib/ai/cloudflare-media";
import { enrichImagePromptWithWebResearch } from "@/lib/ai/image-generation-research";
import {
  MEDIA_ASPECT_RATIOS,
  normalizeMediaAspectRatio,
  withMediaAspectRatioPromptHint,
} from "@/lib/ai/media-aspect-ratio";
import { normalizeGeneratedMediaPrompt } from "@/lib/ai/media-prompt";

const mediaAspectRatioSchema = z.enum(MEDIA_ASPECT_RATIOS);

export function generateMedia(ctx: ToolContext) {
  void ctx;
  return tool({
    description: "Generate an image or video based on a descriptive text prompt. Use 'image' for static visuals and 'video' for short animations. Media generation uses Cloudflare AI when Cloudflare credentials are configured. Omit aspectRatio to use Instagram post format for images and landscape format for videos.",
    inputSchema: z.object({
      mode: z.enum(["image", "video"]).describe("The type of media to generate."),
      prompt: z.string().describe("The user's visual prompt. Preserve the subject and constraints; do not rewrite it as a design brief, product spec, or description of a prompt."),
      aspectRatio: mediaAspectRatioSchema.optional().describe("The aspect ratio for the generated media. Use 4:5 for Instagram posts, 16:9 for YouTube, 9:16 for stories/reels, and 21:9 for cinematic images."),
    }),
    execute: async ({ mode, prompt, aspectRatio }) => {
      const normalizedPrompt = normalizeGeneratedMediaPrompt(prompt, mode);
      const selectedAspectRatio = normalizeMediaAspectRatio(aspectRatio, mode);

      try {
        if (hasCloudflareMediaConfig()) {
          if (mode === "image") {
            const researchedPrompt =
              await enrichImagePromptWithWebResearch(normalizedPrompt);
            const result = await submitCloudflareImageGeneration({
              prompt: withMediaAspectRatioPromptHint(
                researchedPrompt.prompt,
                selectedAspectRatio
              ),
              aspectRatio: selectedAspectRatio,
            });

            return {
              ok: true,
              provider: "cloudflare",
              mode: "image",
              prompt: normalizedPrompt,
              aspectRatio: selectedAspectRatio,
              model: result.model,
              images: result.images,
              usage: result.usage,
              message: "Image generation completed with Cloudflare.",
            };
          }

          const job = await submitCloudflareVideoGeneration({
            prompt: normalizedPrompt,
            aspectRatio: selectedAspectRatio,
          });

          return {
            ok: job.status !== "failed",
            provider: "cloudflare",
            mode: "video",
            prompt: normalizedPrompt,
            aspectRatio: selectedAspectRatio,
            model: job.model,
            jobId: job.jobId,
            status: job.status,
            videos: job.videos,
            usage: job.usage,
            message:
              job.status === "completed"
                ? "Video generation completed with Cloudflare."
                : "Cloudflare video generation is still processing.",
          };
        }

        const xaiKey = process.env.XAI_API_KEY?.trim();
        const nvidiaKey = process.env.NVIDIA_API_KEY?.trim();
        
        if (!xaiKey && !nvidiaKey) {
          return {
            ok: false,
            mode,
            prompt: normalizedPrompt,
            aspectRatio: selectedAspectRatio,
            message:
              mode === "video"
                ? "Configure CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN for video generation."
                : "AI API key not configured for media generation.",
          };
        }

        const providerKey = xaiKey || nvidiaKey;
        const providerName = xaiKey ? "xai" : "nvidia";
        const providerBase = xaiKey
          ? process.env.XAI_BASE_URL?.trim() || "https://api.x.ai/v1"
          : "https://integrate.api.nvidia.com/v1";
        const providerClient = createOpenAICompatible({ name: providerName, baseURL: providerBase, apiKey: providerKey });

        if (mode === "image") {
          const researchedPrompt =
            await enrichImagePromptWithWebResearch(normalizedPrompt);
          const providerModel = process.env.IMAGE_PROVIDER_MODEL || "grok-imagine-image";
          const selectedModel = (providerClient as any).image
            ? (providerClient as any).image(providerModel)
            : (providerClient as any).chatModel(providerModel);

          const result = await generateImage({
            model: selectedModel,
            prompt: withMediaAspectRatioPromptHint(
              researchedPrompt.prompt,
              selectedAspectRatio
            ),
            aspectRatio: selectedAspectRatio,
          });

          const images = result.images.map(img => {
            if (typeof img === 'string') return img;
            if ((img as any).url) return (img as any).url;
            if ((img as any).base64) return `data:image/png;base64,${(img as any).base64}`;
            if ((img as any).data) return `data:image/png;base64,${(img as any).data}`;
            return null;
          }).filter(Boolean) as string[];

          return {
            ok: true,
            mode: "image",
            prompt: normalizedPrompt,
            aspectRatio: selectedAspectRatio,
            images,
            message: "Image generation completed.",
          };
        } else {
          const providerModel = process.env.VIDEO_PROVIDER_MODEL || "grok-imagine-video";
          const selectedModel = (providerClient as any).video
            ? (providerClient as any).video(providerModel)
            : (providerClient as any).chatModel(providerModel);

          const result = await generateVideo({
            model: selectedModel,
            prompt: normalizedPrompt,
            aspectRatio: selectedAspectRatio,
          });

          // Normalize video result
          const videosRaw = (result as any).videos || (Array.isArray(result) ? result : [result]);
          const videos = videosRaw.map((v: any) => {
            if (typeof v === 'string') return v;
            if (v?.url) return v.url;
            if (v?.base64) return `data:video/mp4;base64,${v.base64}`;
            if (v?.data) {
                const data = Array.isArray(v.data) ? Buffer.from(v.data).toString('base64') : v.data;
                return `data:video/mp4;base64,${data}`;
            }
            return null;
          }).filter(Boolean) as string[];

          return {
            ok: true,
            mode: "video",
            prompt: normalizedPrompt,
            aspectRatio: selectedAspectRatio,
            videos,
          };
        }
      } catch (error) {
        console.error("Media generation tool error:", error);
        return {
          ok: false,
          mode,
          prompt: normalizedPrompt,
          aspectRatio: selectedAspectRatio,
          message: error instanceof Error ? error.message : "Failed to generate media.",
        };
      }
    },
  });
}
