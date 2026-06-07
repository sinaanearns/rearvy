import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { MediaAspectRatio } from "./media-aspect-ratio";
import { parseJsonRecordFromText } from "@/lib/ai/json-object";

export type MediaMode = "image" | "image-edit" | "video";
export type MediaProviderPreference =
  | "auto"
  | "cloudflare"
  | "nvidia";
export type OpenAICompatibleMediaProviderName = "nvidia";

const DEFAULT_NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const DEFAULT_NVIDIA_IMAGE_MODEL = "qwen-image-2512";
const DEFAULT_NVIDIA_IMAGE_EDIT_MODEL = "qwen-image-edit-2511";
const DEFAULT_CLOUDFLARE_API_BASE_URL = "https://api.cloudflare.com/client/v4";
const DEFAULT_CLOUDFLARE_IMAGE_MODEL =
  "@cf/black-forest-labs/flux-1-schnell";
const SUPPORTED_NVIDIA_IMAGE_MODELS = [
  "qwen-image",
  "qwen-image-2512",
] as const;
const SUPPORTED_NVIDIA_IMAGE_EDIT_MODELS = [
  "qwen-image-edit",
  "qwen-image-edit-2509",
  "qwen-image-edit-2511",
] as const;

const IMAGE_SIZE_BY_ASPECT_RATIO: Record<MediaAspectRatio, `${number}x${number}`> = {
  "1:1": "1024x1024",
  "4:5": "1024x1280",
  "16:9": "1280x720",
  "9:16": "720x1280",
  "21:9": "1280x576",
  "3:4": "864x1152",
  "4:3": "1152x864",
};

type OpenAICompatibleMediaProvider = {
  apiKey: string;
  baseURL: string;
  model: string;
  name: OpenAICompatibleMediaProviderName;
};

type CloudflareImageProvider = {
  accountId: string;
  apiBaseUrl: string;
  apiToken: string;
  model: string;
  name: "cloudflare";
  steps: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readEnv(name: string) {
  const value = process.env[name]?.trim() || readLocalEnvFileValue(name);
  return value || null;
}

function readLocalEnvFileValue(name: string) {
  if (
    process.env.NODE_ENV === "test" ||
    process.env.npm_lifecycle_event === "test" ||
    process.env.REARVY_DISABLE_ENV_FILE_FALLBACK === "1"
  ) {
    return null;
  }

  const cwd = process.cwd();
  const envPaths = [
    path.resolve(cwd, ".env.local"),
    path.resolve(cwd, "..", ".env.local"),
  ];

  for (const envPath of envPaths) {
    const value = readEnvFileValue(envPath, name);
    if (value) {
      return value;
    }
  }

  return null;
}

function readEnvFileValue(envPath: string, name: string) {
  if (!existsSync(envPath)) {
    return null;
  }

  const prefix = `${name}=`;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.startsWith(prefix)) {
      continue;
    }

    return normalizeEnvFileValue(trimmed.slice(prefix.length));
  }

  return null;
}

function normalizeEnvFileValue(value: string) {
  const trimmed = value.trim();
  const quote = trimmed[0];

  if (
    (quote === `"` || quote === "'") &&
    trimmed.endsWith(quote) &&
    trimmed.length >= 2
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function hasBrowserUseCloudKey() {
  return Boolean(readEnv("BROWSER_USE_API_KEY"));
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function getNvidiaImageBaseUrl() {
  return normalizeBaseUrl(
    readEnv("NVIDIA_IMAGE_BASE_URL") || DEFAULT_NVIDIA_BASE_URL
  );
}

function hasDeployedNvidiaImageNimUrl() {
  const configuredBaseUrl = readEnv("NVIDIA_IMAGE_BASE_URL");

  return Boolean(
    configuredBaseUrl &&
      normalizeBaseUrl(configuredBaseUrl) !== DEFAULT_NVIDIA_BASE_URL
  );
}

function normalizeProviderPreference(
  value: string | null
): MediaProviderPreference {
  const normalized = value?.toLowerCase();

  if (normalized === "cloudflare" || normalized === "nvidia") {
    return normalized;
  }

  return "auto";
}

export function getMediaProviderPreference(mode: MediaMode) {
  if (mode === "image-edit") {
    return normalizeProviderPreference(
      readEnv("MEDIA_IMAGE_EDIT_PROVIDER") ||
        readEnv("MEDIA_IMAGE_PROVIDER") ||
        readEnv("MEDIA_PROVIDER")
    );
  }

  return normalizeProviderPreference(
    readEnv(mode === "image" ? "MEDIA_IMAGE_PROVIDER" : "MEDIA_VIDEO_PROVIDER") ||
      readEnv("MEDIA_PROVIDER")
  );
}

function normalizeNvidiaImageModel(model: string) {
  const cleanModel = model.trim();

  if (cleanModel.startsWith("qwen/qwen-image")) {
    return cleanModel.slice("qwen/".length);
  }

  return cleanModel;
}

function getSupportedNvidiaImageModels(
  mode: Extract<MediaMode, "image" | "image-edit">
) {
  return mode === "image-edit"
    ? SUPPORTED_NVIDIA_IMAGE_EDIT_MODELS
    : SUPPORTED_NVIDIA_IMAGE_MODELS;
}

function formatSupportedNvidiaImageModels(
  mode: Extract<MediaMode, "image" | "image-edit">
) {
  return getSupportedNvidiaImageModels(mode).join(", ");
}

function isSupportedNvidiaImageModel(
  mode: Extract<MediaMode, "image" | "image-edit">,
  model: string
) {
  return (getSupportedNvidiaImageModels(mode) as readonly string[]).includes(
    model
  );
}

function resolveImageModel(
  mode: Extract<MediaMode, "image" | "image-edit">,
  requestedModel?: string
) {
  const cleanRequestedModel = requestedModel?.trim();
  if (cleanRequestedModel) {
    const model = normalizeNvidiaImageModel(cleanRequestedModel);
    return isSupportedNvidiaImageModel(mode, model) ? model : null;
  }

  if (mode === "image-edit") {
    const model = normalizeNvidiaImageModel(
      readEnv("NVIDIA_IMAGE_EDIT_MODEL") ||
      readEnv("IMAGE_EDIT_PROVIDER_MODEL") ||
      DEFAULT_NVIDIA_IMAGE_EDIT_MODEL
    );
    return isSupportedNvidiaImageModel(mode, model) ? model : null;
  }

  const model = normalizeNvidiaImageModel(
    readEnv("NVIDIA_IMAGE_MODEL") ||
    readEnv("IMAGE_PROVIDER_MODEL") ||
    DEFAULT_NVIDIA_IMAGE_MODEL
  );
  return isSupportedNvidiaImageModel(mode, model) ? model : null;
}

function providerFromName(
  name: OpenAICompatibleMediaProviderName,
  mode: MediaMode,
  requestedModel?: string
): OpenAICompatibleMediaProvider | null {
  if (getMediaProviderPreference(mode) === "cloudflare") {
    return null;
  }

  if (mode === "video" || !hasDeployedNvidiaImageNimUrl()) {
    return null;
  }

  const model = resolveImageModel(mode, requestedModel);
  if (!model) {
    return null;
  }

  return {
    apiKey: readEnv("NVIDIA_IMAGE_API_KEY") || readEnv("NVIDIA_API_KEY") || "not-needed",
    baseURL: getNvidiaImageBaseUrl(),
    model,
    name,
  };
}

export function resolveOpenAICompatibleMediaProvider(
  mode: MediaMode,
  requestedModel?: string
) {
  const preference = getMediaProviderPreference(mode);
  const providerOrder: OpenAICompatibleMediaProviderName[] =
    mode === "image-edit"
      ? ["nvidia"]
      : preference === "nvidia"
      ? ["nvidia"]
      : ["nvidia"];

  for (const providerName of providerOrder) {
    const provider = providerFromName(providerName, mode, requestedModel);
    if (provider) {
      return {
        ...provider,
        client: createOpenAICompatible({
          name: provider.name,
          baseURL: provider.baseURL,
          apiKey: provider.apiKey,
        }),
      };
    }
  }

  return null;
}

function parsePositiveInteger(value: string | null, max: number) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return null;
  }

  return Math.min(parsed, max);
}

function getCloudflareApiBaseUrl() {
  return normalizeBaseUrl(
    readEnv("CLOUDFLARE_AI_BASE_URL") || DEFAULT_CLOUDFLARE_API_BASE_URL
  );
}

function isCloudflareImageModel(model: string | undefined) {
  return Boolean(model?.trim().startsWith("@cf/"));
}

function normalizeCloudflareApiToken(value: string) {
  return value.trim().replace(/^Bearer\s+/i, "").trim();
}

function getCloudflareImageCredentialError() {
  const accountId = readEnv("CLOUDFLARE_ACCOUNT_ID");
  const rawApiToken =
    readEnv("CLOUDFLARE_AI_API_TOKEN") || readEnv("CLOUDFLARE_API_TOKEN");

  if (!accountId) {
    return "CLOUDFLARE_ACCOUNT_ID is missing.";
  }

  if (!rawApiToken) {
    return "CLOUDFLARE_AI_API_TOKEN is missing.";
  }

  const apiToken = normalizeCloudflareApiToken(rawApiToken);
  if (/^sk-or-/i.test(apiToken)) {
    return "CLOUDFLARE_AI_API_TOKEN is currently an OpenRouter key. Use a Cloudflare API token with Workers AI access instead.";
  }

  if (/^sk-/i.test(apiToken)) {
    return "CLOUDFLARE_AI_API_TOKEN looks like an OpenAI-compatible provider key. Use a Cloudflare API token with Workers AI access instead.";
  }

  return null;
}

export function resolveCloudflareImageProvider(
  mode: MediaMode,
  requestedModel?: string
): CloudflareImageProvider | null {
  if (mode !== "image") {
    return null;
  }

  const preference = getMediaProviderPreference("image");
  const cleanRequestedModel = requestedModel?.trim();
  if (cleanRequestedModel && !isCloudflareImageModel(cleanRequestedModel)) {
    return null;
  }

  if (
    preference !== "auto" &&
    preference !== "cloudflare" &&
    !isCloudflareImageModel(cleanRequestedModel)
  ) {
    return null;
  }

  if (getCloudflareImageCredentialError()) {
    return null;
  }

  const accountId = readEnv("CLOUDFLARE_ACCOUNT_ID") as string;
  const apiToken = normalizeCloudflareApiToken(
    (readEnv("CLOUDFLARE_AI_API_TOKEN") || readEnv("CLOUDFLARE_API_TOKEN")) as string
  );

  return {
    accountId,
    apiBaseUrl: getCloudflareApiBaseUrl(),
    apiToken,
    model:
      cleanRequestedModel && isCloudflareImageModel(cleanRequestedModel)
        ? cleanRequestedModel
        : readEnv("CLOUDFLARE_IMAGE_MODEL") || DEFAULT_CLOUDFLARE_IMAGE_MODEL,
    name: "cloudflare",
    steps: parsePositiveInteger(readEnv("CLOUDFLARE_IMAGE_STEPS"), 8),
  };
}

export function hasConfiguredMediaProvider(
  mode: MediaMode,
  requestedModel?: string
) {
  return Boolean(
    resolveCloudflareImageProvider(mode, requestedModel) ||
      resolveOpenAICompatibleMediaProvider(mode, requestedModel)
  );
}

function getCloudflareImageConfigError() {
  const credentialError = getCloudflareImageCredentialError();

  if (credentialError) {
    return `${credentialError} Cloudflare image generation needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_AI_API_TOKEN in website/.env.local or the root .env.local.`;
  }

  return (
    "Cloudflare image generation needs CLOUDFLARE_ACCOUNT_ID and " +
    "CLOUDFLARE_AI_API_TOKEN in website/.env.local or the root .env.local. " +
    `Use MEDIA_IMAGE_PROVIDER=cloudflare or auto and CLOUDFLARE_IMAGE_MODEL=${DEFAULT_CLOUDFLARE_IMAGE_MODEL}.`
  );
}

function getNvidiaImageNimBaseUrlError(mode: MediaMode) {
  const task =
    mode === "image-edit" ? "NVIDIA Qwen image editing" : "NVIDIA Qwen image generation";
  const browserUseNote = hasBrowserUseCloudKey()
    ? " BROWSER_USE_API_KEY is only for Browser Use browser automation; it is not an image-generation provider."
    : "";

  return `${task} is a downloadable Visual GenAI NIM. Set NVIDIA_IMAGE_BASE_URL to your deployed NIM /v1 endpoint; the public NVIDIA Integrate base URL returns Not Found for this image endpoint.${browserUseNote}`;
}

function getNvidiaImageModelConfigError(
  mode: Extract<MediaMode, "image" | "image-edit">,
  requestedModel?: string
) {
  const cleanRequestedModel = requestedModel?.trim();
  const model = normalizeNvidiaImageModel(
    cleanRequestedModel ||
      (mode === "image-edit"
        ? readEnv("NVIDIA_IMAGE_EDIT_MODEL") ||
          readEnv("IMAGE_EDIT_PROVIDER_MODEL") ||
          DEFAULT_NVIDIA_IMAGE_EDIT_MODEL
        : readEnv("NVIDIA_IMAGE_MODEL") ||
          readEnv("IMAGE_PROVIDER_MODEL") ||
          DEFAULT_NVIDIA_IMAGE_MODEL)
  );

  if (isSupportedNvidiaImageModel(mode, model)) {
    return null;
  }

  const task =
    mode === "image-edit" ? "NVIDIA Qwen image editing" : "NVIDIA Qwen image generation";

  return `${model} is not supported for ${task}. Use only: ${formatSupportedNvidiaImageModels(mode)}.`;
}

export function getOpenAICompatibleMediaConfigError(
  mode: MediaMode,
  requestedModel?: string
) {
  const preference = getMediaProviderPreference(mode);

  if (mode === "image" && preference === "cloudflare") {
    return getCloudflareImageConfigError();
  }

  if (mode === "image" && preference === "auto") {
    return `${getCloudflareImageConfigError()} Or set NVIDIA_IMAGE_BASE_URL to a deployed NVIDIA Qwen NIM /v1 endpoint.`;
  }

  if (mode === "image-edit" && preference === "cloudflare") {
    return "Cloudflare image generation does not support image editing here. Configure NVIDIA Qwen image editing with NVIDIA_IMAGE_BASE_URL and NVIDIA_IMAGE_EDIT_MODEL.";
  }

  if ((mode === "image" || mode === "image-edit") && !hasDeployedNvidiaImageNimUrl()) {
    return getNvidiaImageNimBaseUrlError(mode);
  }

  if (mode === "image" || mode === "image-edit") {
    const modelError = getNvidiaImageModelConfigError(mode, requestedModel);
    if (modelError) {
      return modelError;
    }
  }

  if (mode === "image-edit") {
    return "NVIDIA_IMAGE_API_KEY or NVIDIA_API_KEY is required for Qwen image editing.";
  }

  if (preference === "nvidia" && mode === "video") {
    return "NVIDIA Cosmos video generation requires NVIDIA_COSMOS_INFER_URL or NVIDIA_COSMOS_BASE_URL.";
  }

  if (preference === "nvidia") {
    return "NVIDIA_API_KEY is required for the selected media provider.";
  }

  return mode === "video"
    ? "Set MEDIA_VIDEO_PROVIDER=nvidia and configure NVIDIA Cosmos video generation."
    : "Configure NVIDIA_API_KEY for image generation.";
}

export function getOpenAICompatibleMediaRuntimeError(
  error: unknown,
  provider: OpenAICompatibleMediaProviderName,
  mode: MediaMode
) {
  const message = error instanceof Error ? error.message : String(error);

  if (
    provider === "nvidia" &&
    (mode === "image" || mode === "image-edit") &&
    /(^|\b)(404|not found)(\b|$)/i.test(message)
  ) {
    return `${getNvidiaImageNimBaseUrlError(mode)} If NVIDIA_IMAGE_BASE_URL already points to your deployment, verify the model name and endpoint path.`;
  }

  return message || "Failed to generate media.";
}

function getImageDimensions(size: `${number}x${number}`) {
  const [width, height] = size.split("x").map((item) => Number.parseInt(item, 10));
  return { height, width };
}

function getCloudflareImageRequestBody(
  provider: CloudflareImageProvider,
  prompt: string,
  aspectRatio: MediaAspectRatio,
  requestedSize?: unknown
) {
  const body: Record<string, unknown> = { prompt };

  if (provider.steps) {
    if (provider.model.includes("flux-1-schnell")) {
      body.steps = provider.steps;
    } else {
      body.num_steps = provider.steps;
    }
  }

  if (!provider.model.includes("flux-1-schnell")) {
    const dimensions = getImageDimensions(
      getImageSizeForAspectRatio(aspectRatio, requestedSize)
    );
    body.width = dimensions.width;
    body.height = dimensions.height;
  }

  return body;
}

function getCloudflareImageDataUrl(payload: unknown) {
  if (!isRecord(payload)) {
    return null;
  }

  const result = isRecord(payload.result) ? payload.result : payload;
  const image = result.image;

  if (typeof image === "string" && image.trim()) {
    const cleanImage = image.trim();
    return cleanImage.startsWith("data:")
      ? cleanImage
      : `data:image/jpeg;base64,${cleanImage}`;
  }

  return null;
}

export function parseCloudflareImageErrorText(text: string, fallback: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return fallback;
  }

  const record = parseJsonRecordFromText(trimmed);
  if (record) {
    const errors = Array.isArray(record.errors)
      ? record.errors
          .map((error) => (isRecord(error) ? error.message : error))
          .filter((message): message is string => typeof message === "string" && message.trim().length > 0)
          .map((message) => message.trim())
      : [];
    if (errors.length > 0) {
      return errors.join("; ");
    }
  }

  return trimmed.slice(0, 500);
}

async function readCloudflareError(response: Response) {
  return parseCloudflareImageErrorText(
    await response.text().catch(() => ""),
    `Cloudflare image generation failed with HTTP ${response.status}.`
  );
}

export async function generateCloudflareImage(input: {
  aspectRatio: MediaAspectRatio;
  prompt: string;
  provider: CloudflareImageProvider;
  requestedSize?: unknown;
}) {
  const url = `${input.provider.apiBaseUrl}/accounts/${encodeURIComponent(
    input.provider.accountId
  )}/ai/run/${input.provider.model}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.provider.apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      getCloudflareImageRequestBody(
        input.provider,
        input.prompt,
        input.aspectRatio,
        input.requestedSize
      )
    ),
  });

  if (!response.ok) {
    throw new Error(await readCloudflareError(response));
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.startsWith("image/")) {
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      image: `data:${contentType};base64,${buffer.toString("base64")}`,
      model: input.provider.model,
      provider: input.provider.name,
    };
  }

  const payload = await response.json().catch(() => null);
  const image = getCloudflareImageDataUrl(payload);
  if (!image) {
    throw new Error("Cloudflare image generation did not return an image.");
  }

  return {
    image,
    model: input.provider.model,
    provider: input.provider.name,
  };
}

export function getImageSizeForAspectRatio(
  aspectRatio: MediaAspectRatio,
  requestedSize?: unknown
): `${number}x${number}` {
  if (
    typeof requestedSize === "string" &&
    /^[1-9]\d{1,4}x[1-9]\d{1,4}$/.test(requestedSize.trim())
  ) {
    return requestedSize.trim() as `${number}x${number}`;
  }

  return IMAGE_SIZE_BY_ASPECT_RATIO[aspectRatio] || "1024x1024";
}

function normalizeBase64Media(
  base64: string,
  mediaType: unknown,
  fallbackMediaType: string
) {
  const cleanBase64 = base64.trim().replace(/\s/g, "");
  if (!cleanBase64) {
    return null;
  }

  const selectedMediaType =
    typeof mediaType === "string" && mediaType.trim()
      ? mediaType.trim()
      : fallbackMediaType;

  return `data:${selectedMediaType};base64,${cleanBase64}`;
}

function normalizeGeneratedMediaItem(
  item: unknown,
  fallbackMediaType: string
) {
  if (typeof item === "string") {
    if (/^(https?:\/\/|data:|blob:)/i.test(item)) {
      return item;
    }

    return normalizeBase64Media(item, fallbackMediaType, fallbackMediaType);
  }

  if (!isRecord(item)) {
    return null;
  }

  const record = item;

  if (typeof record.url === "string" && record.url.trim()) {
    return record.url.trim();
  }

  if (typeof record.base64 === "string") {
    return normalizeBase64Media(
      record.base64,
      record.mediaType,
      fallbackMediaType
    );
  }

  if (typeof record.data === "string") {
    return normalizeBase64Media(record.data, record.mediaType, fallbackMediaType);
  }

  if (record.uint8Array instanceof Uint8Array) {
    return normalizeBase64Media(
      Buffer.from(record.uint8Array).toString("base64"),
      record.mediaType,
      fallbackMediaType
    );
  }

  return null;
}

export function normalizeGeneratedMediaUrls(
  items: unknown[],
  fallbackMediaType: string
) {
  return items
    .map((item) => normalizeGeneratedMediaItem(item, fallbackMediaType))
    .filter((item): item is string => Boolean(item));
}
