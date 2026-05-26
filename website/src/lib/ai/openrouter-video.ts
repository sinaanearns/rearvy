const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_OPENROUTER_VIDEO_MODEL = "google/veo-3.1";

export type OpenRouterVideoStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired"
  | string;

export type OpenRouterVideoJob = {
  provider: "openrouter";
  id: string;
  jobId: string;
  status: OpenRouterVideoStatus;
  model?: string;
  generationId?: string;
  pollingUrl?: string;
  videos: string[];
  unsignedUrls: string[];
  usage?: unknown;
  error?: string;
};

export type OpenRouterVideoSubmitInput = {
  prompt: string;
  model?: string;
  aspectRatio?: string;
  resolution?: string;
  duration?: number;
  size?: string;
  generateAudio?: boolean;
  seed?: number;
};

type OpenRouterVideoResponse = {
  id?: unknown;
  status?: unknown;
  model?: unknown;
  generation_id?: unknown;
  polling_url?: unknown;
  unsigned_urls?: unknown;
  usage?: unknown;
  error?: unknown;
};

function normalizeBaseUrl(value: string | undefined) {
  return (value?.trim() || DEFAULT_OPENROUTER_BASE_URL).replace(/\/+$/, "");
}

function getOpenRouterConfig() {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    baseUrl: normalizeBaseUrl(process.env.OPENROUTER_BASE_URL),
  };
}

export function hasOpenRouterVideoConfig() {
  return Boolean(getOpenRouterConfig());
}

function getOpenRouterHeaders(apiKey: string) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  const referer =
    process.env.OPENROUTER_HTTP_REFERER?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();
  const title = process.env.OPENROUTER_APP_TITLE?.trim() || "Rearvy";

  if (referer) {
    headers["HTTP-Referer"] = referer;
  }

  if (title) {
    headers["X-Title"] = title;
  }

  return headers;
}

function getOpenRouterOrigin(baseUrl: string) {
  try {
    return new URL(baseUrl).origin;
  } catch {
    return "https://openrouter.ai";
  }
}

function normalizeVideoUrl(value: unknown, baseUrl: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const url = value.trim();

  if (/^https?:\/\//i.test(url) || url.startsWith("data:")) {
    return url;
  }

  if (url.startsWith("/")) {
    return `${getOpenRouterOrigin(baseUrl)}${url}`;
  }

  return url;
}

function normalizeOpenRouterVideoJob(
  raw: OpenRouterVideoResponse,
  baseUrl: string
): OpenRouterVideoJob {
  const id = typeof raw.id === "string" ? raw.id : "";
  const rawUrls = Array.isArray(raw.unsigned_urls) ? raw.unsigned_urls : [];
  const unsignedUrls = rawUrls
    .map((url) => normalizeVideoUrl(url, baseUrl))
    .filter((url): url is string => Boolean(url));

  return {
    provider: "openrouter",
    id,
    jobId: id,
    status:
      typeof raw.status === "string" && raw.status.length > 0
        ? raw.status
        : "pending",
    model: typeof raw.model === "string" ? raw.model : undefined,
    generationId:
      typeof raw.generation_id === "string" ? raw.generation_id : undefined,
    pollingUrl:
      typeof raw.polling_url === "string" ? raw.polling_url : undefined,
    videos: unsignedUrls,
    unsignedUrls,
    usage: raw.usage,
    error: typeof raw.error === "string" ? raw.error : undefined,
  };
}

async function parseOpenRouterError(response: Response) {
  const text = await response.text();

  try {
    const json = JSON.parse(text) as { error?: unknown; message?: unknown };
    const error = json.error;

    if (typeof error === "string") {
      return error;
    }

    if (
      error &&
      typeof error === "object" &&
      "message" in error &&
      typeof error.message === "string"
    ) {
      return error.message;
    }

    if (typeof json.message === "string") {
      return json.message;
    }
  } catch {
    // Fall through to the raw response text.
  }

  return text || `OpenRouter request failed with ${response.status}`;
}

function getOpenRouterVideoModel(model?: string) {
  return (
    model?.trim() ||
    process.env.OPENROUTER_VIDEO_MODEL?.trim() ||
    process.env.VIDEO_PROVIDER_MODEL?.trim() ||
    DEFAULT_OPENROUTER_VIDEO_MODEL
  );
}

function compactBody(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== "")
  );
}

export async function submitOpenRouterVideoGeneration(
  input: OpenRouterVideoSubmitInput
) {
  const config = getOpenRouterConfig();

  if (!config) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  const response = await fetch(`${config.baseUrl}/videos`, {
    method: "POST",
    headers: getOpenRouterHeaders(config.apiKey),
    body: JSON.stringify(
      compactBody({
        model: getOpenRouterVideoModel(input.model),
        prompt: input.prompt,
        aspect_ratio: input.aspectRatio,
        resolution: input.resolution,
        duration: input.duration,
        size: input.size,
        generate_audio: input.generateAudio,
        seed: input.seed,
      })
    ),
  });

  if (!response.ok) {
    throw new Error(await parseOpenRouterError(response));
  }

  return normalizeOpenRouterVideoJob(
    (await response.json()) as OpenRouterVideoResponse,
    config.baseUrl
  );
}

export async function pollOpenRouterVideoJob(jobId: string) {
  const config = getOpenRouterConfig();

  if (!config) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  const response = await fetch(
    `${config.baseUrl}/videos/${encodeURIComponent(jobId)}`,
    {
      headers: getOpenRouterHeaders(config.apiKey),
    }
  );

  if (!response.ok) {
    throw new Error(await parseOpenRouterError(response));
  }

  return normalizeOpenRouterVideoJob(
    (await response.json()) as OpenRouterVideoResponse,
    config.baseUrl
  );
}
