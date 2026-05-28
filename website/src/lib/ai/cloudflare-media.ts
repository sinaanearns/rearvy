import sharp from "sharp";
import {
  type MediaAspectRatio,
  isMediaAspectRatio,
} from "./media-aspect-ratio";

const DEFAULT_CLOUDFLARE_API_BASE_URL =
  "https://api.cloudflare.com/client/v4";
const DEFAULT_CLOUDFLARE_IMAGE_MODEL =
  "@cf/black-forest-labs/flux-1-schnell";
const DEFAULT_CLOUDFLARE_VIDEO_MODEL = "google/veo-3.1-fast";
const DEFAULT_IMAGE_MEDIA_TYPE = "image/jpeg";
const DEFAULT_VIDEO_MEDIA_TYPE = "video/mp4";

export type CloudflareMediaStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "cancelled"
  | string;

export type CloudflareMediaResult = {
  provider: "cloudflare";
  mode: "image" | "video";
  model: string;
  id?: string;
  jobId?: string;
  taskId?: string;
  status: CloudflareMediaStatus;
  images: string[];
  videos: string[];
  gatewayMetadata?: unknown;
  usage?: unknown;
  error?: string;
};

export type CloudflareMediaSubmitInput = {
  prompt: string;
  model?: string;
  aspectRatio?: string;
  resolution?: string;
  duration?: number;
  size?: string;
  generateAudio?: boolean;
  seed?: number;
};

type CloudflareConfig = {
  accountId: string;
  apiToken: string;
  apiBaseUrl: string;
  gatewayId?: string;
  requestTimeoutMs?: number;
};

type JsonRecord = Record<string, unknown>;

function getCloudflareConfig(): CloudflareConfig | null {
  const accountId =
    process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ||
    process.env.CF_ACCOUNT_ID?.trim();
  const apiToken =
    process.env.CLOUDFLARE_AI_API_TOKEN?.trim() ||
    process.env.CLOUDFLARE_API_TOKEN?.trim();

  if (!accountId || !apiToken) {
    return null;
  }

  const requestTimeoutMs = Number(
    process.env.CLOUDFLARE_AI_REQUEST_TIMEOUT_MS?.trim()
  );

  return {
    accountId,
    apiToken,
    apiBaseUrl: (
      process.env.CLOUDFLARE_API_BASE_URL?.trim() ||
      DEFAULT_CLOUDFLARE_API_BASE_URL
    ).replace(/\/+$/, ""),
    gatewayId:
      process.env.CLOUDFLARE_AI_GATEWAY_ID?.trim() ||
      process.env.CLOUDFLARE_GATEWAY_ID?.trim() ||
      undefined,
    requestTimeoutMs:
      Number.isFinite(requestTimeoutMs) && requestTimeoutMs > 0
        ? requestTimeoutMs
        : 180000,
  };
}

export function hasCloudflareMediaConfig() {
  return Boolean(getCloudflareConfig());
}

function getCloudflareHeaders(config: CloudflareConfig) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiToken}`,
    "Content-Type": "application/json",
  };

  if (config.gatewayId) {
    headers["cf-aig-gateway-id"] = config.gatewayId;
  }

  if (config.requestTimeoutMs) {
    headers["cf-aig-request-timeout"] = String(config.requestTimeoutMs);
  }

  return headers;
}

function getCloudflareImageModel(model?: string) {
  return (
    model?.trim() ||
    process.env.CLOUDFLARE_IMAGE_MODEL?.trim() ||
    DEFAULT_CLOUDFLARE_IMAGE_MODEL
  );
}

function getCloudflareVideoModel(model?: string) {
  return (
    model?.trim() ||
    process.env.CLOUDFLARE_VIDEO_MODEL?.trim() ||
    DEFAULT_CLOUDFLARE_VIDEO_MODEL
  );
}

function compactBody(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input).filter(
      ([, value]) => value !== undefined && value !== ""
    )
  );
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function unwrapCloudflarePayload(raw: unknown) {
  if (isRecord(raw) && "success" in raw && "result" in raw) {
    return raw.result;
  }

  return raw;
}

function findFirstString(value: unknown, keys: string[]): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase();

    if (
      keys.includes(normalizedKey) &&
      typeof nestedValue === "string" &&
      nestedValue.trim()
    ) {
      return nestedValue.trim();
    }
  }

  for (const nestedValue of Object.values(value)) {
    if (isRecord(nestedValue)) {
      const found = findFirstString(nestedValue, keys);
      if (found) return found;
    }
  }

  return undefined;
}

function normalizeMediaString(value: string, mediaType: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (/^(https?:\/\/|data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }

  const compacted = trimmed.replace(/\s/g, "");
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(compacted) && compacted.length > 64) {
    return `data:${mediaType};base64,${compacted}`;
  }

  return null;
}

function parseAspectRatioValue(aspectRatio?: string) {
  if (!isMediaAspectRatio(aspectRatio)) {
    return null;
  }

  const [width, height] = aspectRatio.split(":").map(Number);
  if (!width || !height) {
    return null;
  }

  return { width, height, ratio: width / height };
}

function parseDataImageUrl(url: string) {
  const match = url.match(/^data:(image\/[a-z0-9.+-]+)(?:;charset=[^;]+)?;base64,([\s\S]+)$/i);
  if (!match) {
    return null;
  }

  return {
    mediaType: match[1],
    data: match[2].replace(/\s/g, ""),
  };
}

export async function applyImageAspectRatioToDataUrl(
  url: string,
  aspectRatio?: MediaAspectRatio
) {
  const parsedRatio = parseAspectRatioValue(aspectRatio);
  const parsedImage = parseDataImageUrl(url);

  if (!parsedRatio || !parsedImage) {
    return url;
  }

  try {
    const buffer = Buffer.from(parsedImage.data, "base64");
    const image = sharp(buffer, { failOn: "none" });
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      return url;
    }

    const currentRatio = metadata.width / metadata.height;
    if (Math.abs(currentRatio - parsedRatio.ratio) < 0.01) {
      return url;
    }

    let width = metadata.width;
    let height = metadata.height;

    if (currentRatio > parsedRatio.ratio) {
      width = Math.max(1, Math.round(metadata.height * parsedRatio.ratio));
    } else {
      height = Math.max(1, Math.round(metadata.width / parsedRatio.ratio));
    }

    const left = Math.max(0, Math.floor((metadata.width - width) / 2));
    const top = Math.max(0, Math.floor((metadata.height - height) / 2));
    const cropped = await sharp(buffer, { failOn: "none" })
      .extract({ left, top, width, height })
      .toBuffer();

    return `data:${parsedImage.mediaType};base64,${cropped.toString("base64")}`;
  } catch {
    return url;
  }
}

async function applyImageAspectRatio(
  images: string[],
  aspectRatio?: string
) {
  if (!isMediaAspectRatio(aspectRatio)) {
    return images;
  }

  return Promise.all(
    images.map((url) => applyImageAspectRatioToDataUrl(url, aspectRatio))
  );
}

function collectMediaUrls(value: unknown, mediaType: string, mediaKeys: string[]) {
  const urls: string[] = [];
  const visited = new Set<unknown>();
  const containerKeys = new Set([
    "data",
    "file",
    "files",
    "output",
    "outputs",
    "response",
    "result",
    "results",
  ]);

  function visit(nestedValue: unknown, isMediaValue: boolean) {
    if (typeof nestedValue === "string") {
      if (isMediaValue) {
        const url = normalizeMediaString(nestedValue, mediaType);
        if (url) urls.push(url);
      }
      return;
    }

    if (Array.isArray(nestedValue)) {
      nestedValue.forEach((item) => visit(item, isMediaValue));
      return;
    }

    if (!isRecord(nestedValue) || visited.has(nestedValue)) {
      return;
    }

    visited.add(nestedValue);

    for (const [key, childValue] of Object.entries(nestedValue)) {
      const normalizedKey = key.toLowerCase();
      const nextIsMediaValue =
        isMediaValue ||
        mediaKeys.includes(normalizedKey) ||
        (isMediaValue && ["url", "urls"].includes(normalizedKey));

      visit(
        childValue,
        nextIsMediaValue || containerKeys.has(normalizedKey)
      );
    }
  }

  visit(value, false);

  return [...new Set(urls)];
}

function getStatusRaw(payload: unknown) {
  if (!isRecord(payload)) {
    return undefined;
  }

  return (
    findFirstString(payload, ["state", "status"]) ||
    (typeof payload.error === "string" ? payload.error : undefined)
  );
}

function normalizeCloudflareStatus(
  rawStatus: unknown,
  hasMedia: boolean
): CloudflareMediaStatus {
  if (typeof rawStatus !== "string" || rawStatus.trim().length === 0) {
    return hasMedia ? "completed" : "pending";
  }

  const normalized = rawStatus.trim().toLowerCase();

  if (["completed", "complete", "done", "success", "succeeded"].includes(normalized)) {
    return "completed";
  }

  if (["failed", "fail", "error", "errored"].includes(normalized)) {
    return "failed";
  }

  if (["cancelled", "canceled"].includes(normalized)) {
    return "cancelled";
  }

  if (["processing", "running", "in_progress"].includes(normalized)) {
    return "in_progress";
  }

  if (["pending", "preparing", "queued", "queueing"].includes(normalized)) {
    return "pending";
  }

  return hasMedia ? "completed" : rawStatus.trim();
}

function normalizeAspectRatioForVeo(aspectRatio?: string) {
  if (["16:9", "9:16", "1:1"].includes(aspectRatio || "")) {
    return aspectRatio;
  }

  if (aspectRatio === "3:4") {
    return "9:16";
  }

  return "16:9";
}

function normalizeResolutionForVeo(resolution?: string) {
  return resolution?.toLowerCase() === "1080p" ? "1080p" : "720p";
}

function normalizeVeoDuration(duration?: number) {
  if (!Number.isFinite(duration)) {
    return "6s";
  }

  if ((duration as number) <= 4) {
    return "4s";
  }

  if ((duration as number) <= 6) {
    return "6s";
  }

  return "8s";
}

function normalizeHailuoDuration(duration?: number) {
  if (!Number.isFinite(duration)) {
    return 6;
  }

  return Math.min(10, Math.max(3, Math.round(duration as number)));
}

function normalizeHailuoResolution(resolution?: string) {
  return resolution?.toLowerCase() === "1080p" ||
    resolution?.toUpperCase() === "1080P"
    ? "1080P"
    : "768P";
}

function buildCloudflareImageInput(input: CloudflareMediaSubmitInput) {
  const model = getCloudflareImageModel(input.model);

  if (model.startsWith("@cf/")) {
    return compactBody({
      prompt: input.prompt,
      seed: input.seed,
      steps: Number(process.env.CLOUDFLARE_IMAGE_STEPS?.trim()) || undefined,
    });
  }

  return compactBody({
    prompt: input.prompt,
    aspect_ratio: input.aspectRatio,
    size: input.size || input.resolution,
    seed: input.seed,
  });
}

function buildCloudflareVideoInput(input: CloudflareMediaSubmitInput) {
  const model = getCloudflareVideoModel(input.model);

  if (model.startsWith("google/veo")) {
    return compactBody({
      prompt: input.prompt,
      duration: normalizeVeoDuration(input.duration),
      aspect_ratio: normalizeAspectRatioForVeo(input.aspectRatio),
      resolution: normalizeResolutionForVeo(input.resolution),
      generate_audio: input.generateAudio ?? true,
      seed: input.seed,
    });
  }

  if (model.startsWith("minimax/hailuo")) {
    return compactBody({
      prompt: input.prompt,
      prompt_optimizer: true,
      fast_pretreatment: model.includes("fast"),
      duration: normalizeHailuoDuration(input.duration),
      resolution: normalizeHailuoResolution(input.resolution),
    });
  }

  return compactBody({
    prompt: input.prompt,
    aspect_ratio: input.aspectRatio,
    resolution: input.resolution,
    duration: input.duration,
    generate_audio: input.generateAudio,
    seed: input.seed,
  });
}

async function parseCloudflareError(response: Response) {
  const text = await response.text();

  try {
    const json = JSON.parse(text) as {
      error?: unknown;
      errors?: unknown;
      message?: unknown;
      messages?: unknown;
    };

    if (Array.isArray(json.errors) && json.errors.length > 0) {
      const firstError = json.errors[0];
      if (
        firstError &&
        typeof firstError === "object" &&
        "message" in firstError &&
        typeof firstError.message === "string"
      ) {
        return firstError.message;
      }
    }

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

    if (Array.isArray(json.messages) && json.messages.length > 0) {
      return json.messages.join(", ");
    }
  } catch {
    // Fall through to the raw response text.
  }

  return text || `Cloudflare AI request failed with ${response.status}`;
}

async function runCloudflareModel(
  model: string,
  input: Record<string, unknown>,
  config: CloudflareConfig
) {
  const isWorkersAiModel = model.startsWith("@cf/");
  const url = isWorkersAiModel
    ? `${config.apiBaseUrl}/accounts/${config.accountId}/ai/run/${model}`
    : `${config.apiBaseUrl}/accounts/${config.accountId}/ai/run`;
  const body = isWorkersAiModel
    ? input
    : {
        model,
        input,
      };

  const response = await fetch(url, {
    method: "POST",
    headers: getCloudflareHeaders(config),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await parseCloudflareError(response));
  }

  return response.json();
}

export function normalizeCloudflareImageGenerationResponse(
  raw: unknown,
  model: string
): CloudflareMediaResult {
  const payload = unwrapCloudflarePayload(raw);
  const images = collectMediaUrls(payload, DEFAULT_IMAGE_MEDIA_TYPE, [
    "image",
    "images",
  ]);
  const status = normalizeCloudflareStatus(getStatusRaw(payload), images.length > 0);
  const error =
    status === "failed"
      ? findFirstString(payload, ["error", "message"])
      : undefined;

  return {
    provider: "cloudflare",
    mode: "image",
    model,
    status,
    images,
    videos: [],
    gatewayMetadata: isRecord(payload) ? payload.gatewayMetadata : undefined,
    usage: isRecord(payload) ? payload.usage : undefined,
    error,
  };
}

export function normalizeCloudflareVideoGenerationResponse(
  raw: unknown,
  model: string
): CloudflareMediaResult {
  const payload = unwrapCloudflarePayload(raw);
  const videos = collectMediaUrls(payload, DEFAULT_VIDEO_MEDIA_TYPE, [
    "video",
    "videos",
  ]);
  const status = normalizeCloudflareStatus(getStatusRaw(payload), videos.length > 0);
  const taskId = findFirstString(payload, ["task_id", "taskid"]);
  const id = findFirstString(payload, ["id", "job_id", "jobid"]) || taskId;
  const error =
    status === "failed"
      ? findFirstString(payload, ["error", "message"])
      : undefined;

  return {
    provider: "cloudflare",
    mode: "video",
    model,
    id,
    taskId,
    jobId: undefined,
    status,
    images: [],
    videos,
    gatewayMetadata: isRecord(payload) ? payload.gatewayMetadata : undefined,
    usage: isRecord(payload) ? payload.usage : undefined,
    error,
  };
}

export async function submitCloudflareImageGeneration(
  input: CloudflareMediaSubmitInput
) {
  const config = getCloudflareConfig();

  if (!config) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required for Cloudflare media generation."
    );
  }

  const model = getCloudflareImageModel(input.model);
  const raw = await runCloudflareModel(
    model,
    buildCloudflareImageInput(input),
    config
  );
  const result = normalizeCloudflareImageGenerationResponse(raw, model);

  if (result.images.length === 0) {
    throw new Error(
      result.error || "Cloudflare completed without returning an image."
    );
  }

  return {
    ...result,
    images: await applyImageAspectRatio(result.images, input.aspectRatio),
  };
}

export async function submitCloudflareVideoGeneration(
  input: CloudflareMediaSubmitInput
) {
  const config = getCloudflareConfig();

  if (!config) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required for Cloudflare media generation."
    );
  }

  const model = getCloudflareVideoModel(input.model);
  const raw = await runCloudflareModel(
    model,
    buildCloudflareVideoInput(input),
    config
  );
  const result = normalizeCloudflareVideoGenerationResponse(raw, model);

  if (result.videos.length === 0) {
    throw new Error(
      result.error ||
        "Cloudflare did not return a playable video URL in this response."
    );
  }

  return result;
}
