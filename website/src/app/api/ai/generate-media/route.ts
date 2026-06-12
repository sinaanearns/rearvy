import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { generateImage, experimental_generateVideo as generateVideo } from "ai";
import { enrichImagePromptWithWebResearch } from "@/lib/ai/image-generation-research";
import {
  normalizeMediaAspectRatio,
  withMediaAspectRatioPromptHint,
} from "@/lib/ai/media-aspect-ratio";
import { normalizeGeneratedMediaPrompt } from "@/lib/ai/media-prompt";
import { pollOpenRouterVideoJob } from "@/lib/ai/openrouter-video";
import {
  getMediaProviderPreference,
  getImageSizeForAspectRatio,
  getOpenAICompatibleMediaConfigError,
  getOpenAICompatibleMediaRuntimeError,
  generateCloudflareImage,
  normalizeInputImageUrls,
  normalizeGeneratedMediaUrls,
  resolveCloudflareImageProvider,
  resolveOpenAICompatibleMediaProvider,
} from "@/lib/ai/media-provider";
import {
  getNvidiaCosmosVideoConfigError,
  hasNvidiaCosmosVideoConfig,
  isNvidiaCosmosVideoModel,
  submitNvidiaCosmosVideoGeneration,
} from "@/lib/ai/nvidia-cosmos-video";
import {
  isRecord,
  isRequestBodyError,
  readJsonRecord,
} from "@/lib/api/request-body";
import { createServerLogger } from "@/lib/server-logger";

export const runtime = "nodejs";
type GeneratedVideoModel = Parameters<typeof generateVideo>[0]["model"];
type MediaGenerationMode = "image" | "image-edit" | "video";
const log = createServerLogger("GenerateMediaApi");

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizePixelResolution(value: string | undefined): `${number}x${number}` | undefined {
  if (!value) return undefined;

  const trimmed = value.trim();
  if (/^[1-9]\d{1,4}x[1-9]\d{1,4}$/.test(trimmed)) {
    return trimmed as `${number}x${number}`;
  }

  if (trimmed === "720p") return "1280x720";
  if (trimmed === "1080p") return "1920x1080";

  return undefined;
}

function normalizeMode(value: unknown): MediaGenerationMode | null {
  return value === "image" || value === "image-edit" || value === "video"
    ? value
    : null;
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

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const requestBody = await readJsonRecord(request);
    const mode = normalizeMode(requestBody.mode);
    const prompt = optionalString(requestBody.prompt);
    const model = undefined;
    const n = optionalNumber(requestBody.n) ?? 1;
    const aspect_ratio = requestBody.aspect_ratio;
    const resolution = optionalString(requestBody.resolution);
    const duration = optionalNumber(requestBody.duration);
    const fps = optionalNumber(requestBody.fps);
    const rawInputImages = requestBody.inputImages;
    const rawImages = requestBody.images;
    const rawImage = requestBody.image;
    const inputImages = normalizeInputImageUrls(
      rawInputImages ?? rawImages ?? rawImage
    );

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }

    if (!mode && inputImages.length === 0) {
      return NextResponse.json({ error: "Invalid mode. Use 'image', 'image-edit', or 'video'." }, { status: 400 });
    }

    const effectiveMode: MediaGenerationMode =
      mode === "image-edit" || inputImages.length > 0
        ? "image-edit"
        : mode ?? "image";
    const shouldUseNvidiaCosmosVideo =
      effectiveMode === "video" &&
      (getMediaProviderPreference("video") === "nvidia" ||
        isNvidiaCosmosVideoModel(model));

    if (shouldUseNvidiaCosmosVideo) {
      if (!hasNvidiaCosmosVideoConfig()) {
        return NextResponse.json(
          { error: getNvidiaCosmosVideoConfigError() },
          { status: 503 }
        );
      }

      const selectedAspectRatio = normalizeMediaAspectRatio(
        aspect_ratio,
        "video"
      );
      const result = await submitNvidiaCosmosVideoGeneration({
        prompt,
        model,
        aspectRatio: selectedAspectRatio,
        resolution,
        duration,
        fps,
      });

      return NextResponse.json({
        provider: result.provider,
        model: result.model,
        status: result.status,
        aspectRatio: selectedAspectRatio,
        videos: result.videos,
        message: "Video generation completed with NVIDIA Cosmos.",
      });
    }

    const cloudflareProvider = resolveCloudflareImageProvider(
      effectiveMode,
      model
    );
    if (cloudflareProvider) {
      const normalizedPrompt = normalizeGeneratedMediaPrompt(
        prompt,
        effectiveMode
      );
      const selectedAspectRatio = normalizeMediaAspectRatio(
        aspect_ratio,
        "image"
      );
      const researchedPrompt = await enrichImagePromptWithWebResearch(
        normalizedPrompt
      );
      const result = await generateCloudflareImage({
        provider: cloudflareProvider,
        prompt: withMediaAspectRatioPromptHint(
          researchedPrompt.prompt,
          selectedAspectRatio
        ),
        aspectRatio: selectedAspectRatio,
        requestedSize: resolution,
      });

      return NextResponse.json({
        provider: result.provider,
        model: result.model,
        mode: "image",
        aspectRatio: selectedAspectRatio,
        images: [result.image],
        message: "Image generation completed with Cloudflare Workers AI.",
      });
    }

    const mediaProvider = resolveOpenAICompatibleMediaProvider(
      effectiveMode,
      model
    );

    if (!mediaProvider) {
      return NextResponse.json(
        { error: getOpenAICompatibleMediaConfigError(effectiveMode, model) },
        { status: 503 }
      );
    }

    if (effectiveMode === "image" || effectiveMode === "image-edit") {
      if (effectiveMode === "image-edit" && inputImages.length === 0) {
        return NextResponse.json(
          { error: "Image editing requires at least one input image." },
          { status: 400 }
        );
      }

      const normalizedPrompt = normalizeGeneratedMediaPrompt(
        prompt,
        effectiveMode
      );
      const selectedAspectRatio = normalizeMediaAspectRatio(
        aspect_ratio,
        "image"
      );
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
                images: inputImages,
              }
            : withMediaAspectRatioPromptHint(
                researchedPrompt.prompt,
                selectedAspectRatio
              ),
        n,
        size: getImageSizeForAspectRatio(selectedAspectRatio, resolution),
      }).catch((error) => {
        throw new Error(
          getOpenAICompatibleMediaRuntimeError(
            error,
            mediaProvider.name,
            effectiveMode
          )
        );
      });

      return NextResponse.json({
        provider: mediaProvider.name,
        model: mediaProvider.model,
        mode: effectiveMode,
        aspectRatio: selectedAspectRatio,
        images: normalizeGeneratedMediaUrls(result.images, "image/png"),
        providerMetadata: {
          ...((result.providerMetadata || {}) as Record<string, unknown>),
        },
        usage: result.usage,
        message:
          effectiveMode === "image-edit"
            ? "Image edit completed with NVIDIA Qwen."
            : "Image generation completed.",
      });
    }

    if (effectiveMode === "video") {
      const selectedAspectRatio = normalizeMediaAspectRatio(
        aspect_ratio,
        "video"
      );
      const selectedModel = resolveVideoModel(
        mediaProvider.client,
        mediaProvider.model
      );

      const result = await generateVideo({
        model: selectedModel,
        prompt,
        n,
        aspectRatio: selectedAspectRatio,
        resolution: normalizePixelResolution(resolution),
        duration,
        fps,
      });

      return NextResponse.json({
        provider: mediaProvider.name,
        model: mediaProvider.model,
        aspectRatio: selectedAspectRatio,
        videos: normalizeGeneratedMediaUrls(
          getGeneratedVideoItems(result),
          "video/mp4"
        ),
        providerMetadata: result.providerMetadata,
      });
    }

    return NextResponse.json({ error: "Invalid mode. Use 'image', 'image-edit', or 'video'." }, { status: 400 });
  } catch (err) {
    if (isRequestBodyError(err)) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    log.error("Media generation error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to generate media",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const jobId = request.nextUrl.searchParams.get("jobId")?.trim();
  const provider = request.nextUrl.searchParams.get("provider")?.trim();

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId." }, { status: 400 });
  }

  if (provider && provider !== "openrouter") {
    return NextResponse.json(
      {
        error: "Unsupported video job provider.",
      },
      { status: 400 }
    );
  }

  try {
    const job = await pollOpenRouterVideoJob(jobId);

    return NextResponse.json({
      ...job,
      videos: job.videos,
    });
  } catch (err) {
    log.error("OpenRouter video poll error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to poll OpenRouter video job.",
      },
      { status: 500 }
    );
  }
}
