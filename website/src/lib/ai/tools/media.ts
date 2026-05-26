import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import { generateImage, experimental_generateVideo as generateVideo } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  hasOpenRouterVideoConfig,
  submitOpenRouterVideoGeneration,
} from "@/lib/ai/openrouter-video";

export function generateMedia(ctx: ToolContext) {
  void ctx;
  return tool({
    description: "Generate an image or video based on a descriptive text prompt. Use 'image' for static visuals and 'video' for short animations. Video generation uses OpenRouter video models when OPENROUTER_API_KEY is configured.",
    inputSchema: z.object({
      mode: z.enum(["image", "video"]).describe("The type of media to generate."),
      prompt: z.string().describe("A detailed description of the visual content to create."),
      aspectRatio: z.enum(["1:1", "16:9", "9:16", "4:3", "3:4"]).optional().default("1:1").describe("The aspect ratio for the generated media."),
    }),
    execute: async ({ mode, prompt, aspectRatio }) => {
      try {
        if (mode === "video" && hasOpenRouterVideoConfig()) {
          const job = await submitOpenRouterVideoGeneration({
            prompt,
            aspectRatio,
          });

          return {
            ok: job.status !== "failed",
            provider: "openrouter",
            mode: "video",
            prompt,
            jobId: job.jobId,
            status: job.status,
            pollingUrl: job.pollingUrl,
            videos: job.videos,
            usage: job.usage,
            message:
              job.status === "completed"
                ? "Video generation completed."
                : "OpenRouter video job submitted. The preview will update when it is ready.",
          };
        }

        const xaiKey = process.env.XAI_API_KEY?.trim();
        const nvidiaKey = process.env.NVIDIA_API_KEY?.trim();
        
        if (!xaiKey && !nvidiaKey) {
          return {
            ok: false,
            message:
              mode === "video"
                ? "OPENROUTER_API_KEY is required for OpenRouter video generation."
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
          const providerModel = process.env.IMAGE_PROVIDER_MODEL || "grok-imagine-image";
          const selectedModel = (providerClient as any).image
            ? (providerClient as any).image(providerModel)
            : (providerClient as any).chatModel(providerModel);

          const result = await generateImage({
            model: selectedModel,
            prompt,
            aspectRatio: aspectRatio as any,
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
            prompt,
            images,
          };
        } else {
          const providerModel = process.env.VIDEO_PROVIDER_MODEL || "grok-imagine-video";
          const selectedModel = (providerClient as any).video
            ? (providerClient as any).video(providerModel)
            : (providerClient as any).chatModel(providerModel);

          const result = await generateVideo({
            model: selectedModel,
            prompt,
            aspectRatio: aspectRatio as any,
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
            prompt,
            videos,
          };
        }
      } catch (error) {
        console.error("Media generation tool error:", error);
        return {
          ok: false,
          message: error instanceof Error ? error.message : "Failed to generate media.",
        };
      }
    },
  });
}
