import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { generateImage, generateVideo } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { user, error } = await requireAuth(request);
  if (error) return error;

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

    const nvidiaKey = process.env.NVIDIA_API_KEY?.trim();
    if (!nvidiaKey) {
      return NextResponse.json({ error: "AI API key not configured" }, { status: 503 });
    }

    const nvidia = createOpenAI({ baseURL: "https://integrate.api.nvidia.com/v1", apiKey: nvidiaKey });

    if (mode === "image") {
      const providerModel = model || process.env.IMAGE_PROVIDER_MODEL || "grok-imagine-image";
      const selectedModel = (nvidia as any).image
        ? (nvidia as any).image(providerModel)
        : (nvidia as any).chat(providerModel);

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
      const selectedModel = (nvidia as any).video
        ? (nvidia as any).video(providerModel)
        : (nvidia as any).chat(providerModel);

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
    return NextResponse.json({ error: "Failed to generate media" }, { status: 500 });
  }
}
