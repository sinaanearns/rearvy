import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { MediaAspectRatio } from "./media-aspect-ratio";

export type MediaMode = "image" | "image-edit" | "video";
export type MediaProviderPreference =
  | "auto"
  | "nvidia";
export type OpenAICompatibleMediaProviderName = "nvidia";

const DEFAULT_NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const DEFAULT_NVIDIA_IMAGE_MODEL = "qwen-image-2512";
const DEFAULT_NVIDIA_IMAGE_EDIT_MODEL = "qwen-image-edit-2511";
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

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value || null;
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

  if (normalized === "nvidia") {
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

function getNvidiaImageNimBaseUrlError(mode: MediaMode) {
  const task =
    mode === "image-edit" ? "NVIDIA Qwen image editing" : "NVIDIA Qwen image generation";

  return `${task} is a downloadable Visual GenAI NIM. Set NVIDIA_IMAGE_BASE_URL to your deployed NIM /v1 endpoint; the public NVIDIA Integrate base URL returns Not Found for this image endpoint.`;
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

  if (!item || typeof item !== "object") {
    return null;
  }

  const record = item as Record<string, unknown>;

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
