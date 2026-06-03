import type { MediaAspectRatio } from "./media-aspect-ratio";

const DEFAULT_NVIDIA_COSMOS_VIDEO_MODEL = "nvidia/cosmos-predict1-7b";
const DEFAULT_VIDEO_MEDIA_TYPE = "video/mp4";

export type NvidiaCosmosVideoStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "cancelled"
  | string;

export type NvidiaCosmosVideoResult = {
  provider: "nvidia";
  model: string;
  status: NvidiaCosmosVideoStatus;
  videos: string[];
  raw?: unknown;
  error?: string;
};

export type NvidiaCosmosVideoSubmitInput = {
  prompt: string;
  model?: string;
  aspectRatio?: MediaAspectRatio | string;
  resolution?: string;
  duration?: number;
  fps?: number;
  seed?: number;
};

type NvidiaCosmosConfig = {
  apiKey?: string;
  inferUrl: string;
  model: string;
};

function readEnv(name: string) {
  return process.env[name]?.trim() || "";
}

function normalizeInferUrl(value: string) {
  const clean = value.trim().replace(/\/+$/, "");

  if (/\/v1\/infer$/i.test(clean) || /\/infer$/i.test(clean)) {
    return clean;
  }

  if (/\/v1$/i.test(clean)) {
    return `${clean}/infer`;
  }

  return `${clean}/v1/infer`;
}

function getNvidiaCosmosVideoModel(model?: string) {
  return (
    model?.trim() ||
    readEnv("NVIDIA_COSMOS_VIDEO_MODEL") ||
    readEnv("NVIDIA_VIDEO_MODEL") ||
    DEFAULT_NVIDIA_COSMOS_VIDEO_MODEL
  );
}

function getNvidiaCosmosConfig(model?: string): NvidiaCosmosConfig | null {
  const inferUrl =
    readEnv("NVIDIA_COSMOS_INFER_URL") || readEnv("NVIDIA_VIDEO_INFER_URL");
  const baseUrl =
    readEnv("NVIDIA_COSMOS_BASE_URL") ||
    readEnv("NVIDIA_VIDEO_BASE_URL") ||
    readEnv("NVIDIA_NIM_BASE_URL");
  const resolvedUrl = inferUrl || (baseUrl ? normalizeInferUrl(baseUrl) : "");

  if (!resolvedUrl) {
    return null;
  }

  return {
    apiKey:
      readEnv("NVIDIA_COSMOS_API_KEY") ||
      readEnv("NVIDIA_VIDEO_API_KEY") ||
      readEnv("NVIDIA_API_KEY") ||
      undefined,
    inferUrl: resolvedUrl,
    model: getNvidiaCosmosVideoModel(model),
  };
}

export function hasNvidiaCosmosVideoConfig() {
  return Boolean(getNvidiaCosmosConfig());
}

export function getNvidiaCosmosVideoConfigError() {
  return "NVIDIA Cosmos video generation requires NVIDIA_COSMOS_INFER_URL or NVIDIA_COSMOS_BASE_URL pointing to a Cosmos NIM /v1/infer endpoint.";
}

export function isNvidiaCosmosVideoModel(model: unknown) {
  if (typeof model !== "string") {
    return false;
  }

  return model.trim().toLowerCase().includes("cosmos");
}

function parseSeed(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function compactBody(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input).filter(
      ([, value]) => value !== undefined && value !== ""
    )
  );
}

function buildNvidiaCosmosBody(input: NvidiaCosmosVideoSubmitInput) {
  return compactBody({
    prompt: input.prompt,
    seed: input.seed ?? parseSeed(readEnv("NVIDIA_COSMOS_SEED")),
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeVideoString(value: string, key: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^(https?:\/\/|data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }

  const compacted = trimmed.replace(/\s/g, "");
  const likelyBase64 =
    /^[A-Za-z0-9+/]+={0,2}$/.test(compacted) && compacted.length > 64;
  const videoLikeKey = /video|b64|base64|mp4|data|output/i.test(key);

  return likelyBase64 && videoLikeKey
    ? `data:${DEFAULT_VIDEO_MEDIA_TYPE};base64,${compacted}`
    : null;
}

function collectVideos(value: unknown, key = ""): string[] {
  if (typeof value === "string") {
    const normalized = normalizeVideoString(value, key);
    return normalized ? [normalized] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectVideos(item, key));
  }

  if (!isRecord(value)) {
    return [];
  }

  const videos: string[] = [];
  for (const [entryKey, nestedValue] of Object.entries(value)) {
    videos.push(...collectVideos(nestedValue, entryKey));
  }

  return [...new Set(videos)];
}

function normalizeStatus(raw: unknown, hasVideos: boolean): NvidiaCosmosVideoStatus {
  if (hasVideos) {
    return "completed";
  }

  if (isRecord(raw)) {
    const status = raw.status || raw.state;
    if (typeof status === "string" && status.trim()) {
      return status.trim();
    }
  }

  return "pending";
}

async function parseNvidiaCosmosError(response: Response) {
  const text = await response.text();

  try {
    const json = JSON.parse(text) as { error?: unknown; message?: unknown };
    if (typeof json.error === "string") {
      return json.error;
    }
    if (
      json.error &&
      typeof json.error === "object" &&
      "message" in json.error &&
      typeof json.error.message === "string"
    ) {
      return json.error.message;
    }
    if (typeof json.message === "string") {
      return json.message;
    }
  } catch {
    // Use the raw body below.
  }

  return text || `NVIDIA Cosmos request failed with ${response.status}`;
}

export function normalizeNvidiaCosmosVideoResponse(
  raw: unknown,
  model: string
): NvidiaCosmosVideoResult {
  const videos = collectVideos(raw);
  const status = normalizeStatus(raw, videos.length > 0);
  const error =
    status === "failed" && isRecord(raw) && typeof raw.error === "string"
      ? raw.error
      : undefined;

  return {
    provider: "nvidia",
    model,
    status,
    videos,
    raw,
    error,
  };
}

export async function submitNvidiaCosmosVideoGeneration(
  input: NvidiaCosmosVideoSubmitInput
) {
  const config = getNvidiaCosmosConfig(input.model);
  if (!config) {
    throw new Error(getNvidiaCosmosVideoConfigError());
  }

  const headers: Record<string, string> = {
    accept: "application/json",
    "Content-Type": "application/json",
  };

  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  const response = await fetch(config.inferUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(buildNvidiaCosmosBody(input)),
  });

  if (!response.ok) {
    throw new Error(await parseNvidiaCosmosError(response));
  }

  const result = normalizeNvidiaCosmosVideoResponse(
    await response.json(),
    config.model
  );

  if (result.videos.length === 0) {
    throw new Error(
      result.error || "NVIDIA Cosmos did not return a playable video."
    );
  }

  return result;
}
