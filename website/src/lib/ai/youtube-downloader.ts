import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("ReferenceVideoSource");

export type ReferenceSourceUseMode =
  | "reference_only"
  | "owned_or_licensed_assets";

export interface YouTubeDownloadOptions {
  youtubeUrl: string;
  saveFromUrl?: string;
  quality?: string;
  sourceUseMode?: ReferenceSourceUseMode;
}

export interface YouTubeDownloadResult {
  success: boolean;
  youtubeUrl: string;
  videoId?: string;
  referenceUrl?: string;
  downloadUrl?: string;
  fileName?: string;
  title?: string;
  sourceUseMode: ReferenceSourceUseMode;
  error?: string;
  message?: string;
}

export function extractYouTubeVideoId(url: string): string | null {
  if (!url || typeof url !== "string") return null;

  try {
    const parsedUrl = new URL(url.trim());
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      return null;
    }

    const host = parsedUrl.hostname.toLowerCase();
    if (host === "youtu.be" || host === "www.youtu.be") {
      const videoId = parsedUrl.pathname.split("/").filter(Boolean)[0];
      return /^[\w-]{11}$/.test(videoId ?? "") ? videoId : null;
    }

    const isYouTubeHost =
      host === "youtube.com" ||
      host === "www.youtube.com" ||
      host === "m.youtube.com";
    if (!isYouTubeHost) {
      return null;
    }

    const watchVideoId = parsedUrl.searchParams.get("v");
    if (/^[\w-]{11}$/.test(watchVideoId ?? "")) {
      return watchVideoId;
    }

    const [route, videoId] = parsedUrl.pathname.split("/").filter(Boolean);
    return ["embed", "v", "shorts"].includes(route) && /^[\w-]{11}$/.test(videoId ?? "")
      ? videoId
      : null;
  } catch {
    return null;
  }
}

function normalizeSourceUseMode(value: unknown): ReferenceSourceUseMode {
  return value === "owned_or_licensed_assets"
    ? "owned_or_licensed_assets"
    : "reference_only";
}

export async function resolveSaveFromDownloadUrl(
  options: YouTubeDownloadOptions
): Promise<YouTubeDownloadResult> {
  const sourceUseMode = normalizeSourceUseMode(options.sourceUseMode);
  const youtubeUrl = options.youtubeUrl.trim();
  const videoId = extractYouTubeVideoId(youtubeUrl);

  log.info(
    `Resolving reference video URL "${youtubeUrl}" (Video ID: ${videoId || "unknown"})`
  );

  if (!videoId) {
    return {
      success: false,
      youtubeUrl,
      sourceUseMode,
      error: "Invalid YouTube URL provided.",
    };
  }

  return {
    success: true,
    youtubeUrl,
    videoId,
    referenceUrl: youtubeUrl,
    fileName: `reference-${videoId}.mp4`,
    title: `YouTube reference ${videoId}`,
    sourceUseMode,
    message:
      sourceUseMode === "owned_or_licensed_assets"
        ? "Reference accepted for planning. Use a local file or official export path for asset ingestion."
        : "Reference accepted for visual breakdown and inspiration. Rearvy will create original assets instead of downloading the source video.",
  };
}
