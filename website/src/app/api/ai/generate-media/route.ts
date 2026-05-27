import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { generateImage, experimental_generateVideo as generateVideo } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  hasCloudflareMediaConfig,
  submitCloudflareImageGeneration,
  submitCloudflareVideoGeneration,
} from "@/lib/ai/cloudflare-media";
import { pollOpenRouterVideoJob } from "@/lib/ai/openrouter-video";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const {
      mode,
      prompt,
      model,
      n = 1,
      aspect_ratio,
      resolution,
      duration,
      fps,
    } = body as any;

    if (hasCloudflareMediaConfig()) {
      if (mode === "image") {
        const result = await submitCloudflareImageGeneration({
          prompt,
          model,
          aspectRatio: aspect_ratio,
          resolution,
        });

        return NextResponse.json({
          provider: "cloudflare",
          model: result.model,
          images: result.images,
          providerMetadata: result.gatewayMetadata,
        });
      }

      if (mode === "video") {
        const job = await submitCloudflareVideoGeneration({
          prompt,
          model,
          aspectRatio: aspect_ratio,
          resolution,
          duration,
        });

        return NextResponse.json({
          ...job,
          videos: job.videos,
          message:
            job.status === "completed"
              ? "Video generation completed with Cloudflare."
              : "Cloudflare video generation is still processing.",
        });
      }
    }

    // Prefer XAI key if present, otherwise fall back to NVIDIA
    const xaiKey = process.env.XAI_API_KEY?.trim();
    const nvidiaKey = process.env.NVIDIA_API_KEY?.trim();
    if (!xaiKey && !nvidiaKey) {
      return NextResponse.json(
        {
          error:
            mode === "video"
              ? "Configure CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN for video generation."
              : "AI API key not configured",
        },
        { status: 503 }
      );
    }

    const providerKey = xaiKey || nvidiaKey;
    const providerName = xaiKey ? "xai" : "nvidia";
    const providerBase = xaiKey
      ? process.env.XAI_BASE_URL?.trim() || "https://api.x.ai/v1"
      : "https://integrate.api.nvidia.com/v1";
    const providerClient = createOpenAICompatible({ name: providerName, baseURL: providerBase, apiKey: providerKey });

    if (mode === "image") {
      const providerModel = model || process.env.IMAGE_PROVIDER_MODEL || "grok-imagine-image";
      const selectedModel = (providerClient as any).image
        ? (providerClient as any).image(providerModel)
        : (providerClient as any).chatModel(providerModel);

      const result = await generateImage({
        model: selectedModel,
        prompt,
        n,
        aspectRatio: aspect_ratio,
        size: resolution,
      });

      return NextResponse.json({ images: result.images, providerMetadata: result.providerMetadata });
    }

    if (mode === "video") {
      const providerModel = model || process.env.VIDEO_PROVIDER_MODEL || "grok-imagine-video";
      const selectedModel = (providerClient as any).video
        ? (providerClient as any).video(providerModel)
        : (providerClient as any).chatModel(providerModel);

      const result = await generateVideo({
        model: selectedModel,
        prompt,
        n,
        aspectRatio: aspect_ratio,
        resolution,
        duration,
        fps,
      });

      return NextResponse.json({ videos: result.videos || result, providerMetadata: result.providerMetadata });
    }

    return NextResponse.json({ error: "Invalid mode. Use 'image' or 'video'." }, { status: 400 });
  } catch (err) {
    console.error("Media generation error:", err);
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

  if (provider === "cloudflare" || jobId.startsWith("cloudflare:")) {
    return NextResponse.json(
      {
        error:
          "Cloudflare media generation does not expose a compatible polling endpoint in this integration.",
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
    console.error("OpenRouter video poll error:", err);
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
