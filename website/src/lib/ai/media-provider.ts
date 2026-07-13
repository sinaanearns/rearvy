import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { MediaAspectRatio } from "./media-aspect-ratio";

import {
  normalizeGeneratedMediaMimeType,
  normalizeGeneratedMediaUrl,
  type GeneratedMediaKind,
} from "@/lib/chat/generated-media-url";

export type MediaMode = "image" | "image-edit" | "video";
export type MediaProviderPreference =
  | "auto"
  | "nvidia";
export type OpenAICompatibleMediaProviderName = "nvidia";

const DEFAULT_NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const DEFAULT_NVIDIA_IMAGE_MODEL = "qwen-image-2512";
const DEFAULT_NVIDIA_IMAGE_EDIT_MODEL = "qwen-image-edit-2511";
const DEFAULT_NVIDIA_GENAI_BASE_URL = "https://ai.api.nvidia.com/v1/genai";
const DEFAULT_NVIDIA_GENAI_IMAGE_MODEL = "black-forest-labs/flux-schnell";

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

export type NvidiaGenAIImageProvider = {
  apiKey: string;
  baseUrl: string;
  model: string;
  name: "nvidia";
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



function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function getNvidiaImageBaseUrl() {
  return normalizeBaseUrl(
    readEnv("NVIDIA_IMAGE_BASE_URL") || DEFAULT_NVIDIA_BASE_URL
  );
}

function hasNvidiaImageApiKey() {
  return Boolean(readEnv("NVIDIA_IMAGE_API_KEY") || readEnv("NVIDIA_API_KEY"));
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
  if (mode === "video") {
    return null;
  }

  if (!hasNvidiaImageApiKey()) {
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

// ---------------------------------------------------------------------------
// NVIDIA GenAI endpoint — public API (ai.api.nvidia.com/v1/genai)
// Works with any nvapi-* key; supports flux-schnell, flux-dev, sdxl-turbo, etc.
// ---------------------------------------------------------------------------

const GENAI_ASPECT_RATIO_MAP: Record<MediaAspectRatio, string> = {
  "1:1": "1:1",
  "4:5": "4:5",
  "16:9": "16:9",
  "9:16": "9:16",
  "21:9": "16:9", // flux-schnell doesn't support ultra-wide; fall back to 16:9
  "3:4": "3:4",
  "4:3": "4:3",
};

function getGenAIAspectRatio(aspectRatio: MediaAspectRatio): string {
  return GENAI_ASPECT_RATIO_MAP[aspectRatio] ?? "1:1";
}

export function resolveNvidiaGenAIImageProvider(
  mode: MediaMode
): NvidiaGenAIImageProvider | null {
  // GenAI endpoint is text-to-image only (no edit, no video).
  if (mode !== "image") {
    return null;
  }

  const apiKey = readEnv("NVIDIA_IMAGE_API_KEY") || readEnv("NVIDIA_API_KEY");
  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    baseUrl: normalizeBaseUrl(
      readEnv("NVIDIA_GENAI_BASE_URL") || DEFAULT_NVIDIA_GENAI_BASE_URL
    ),
    model:
      readEnv("NVIDIA_GENAI_IMAGE_MODEL") || DEFAULT_NVIDIA_GENAI_IMAGE_MODEL,
    name: "nvidia",
  };
}

function extractGenAIBase64(payload: unknown): string | null {
  if (!isRecord(payload)) return null;

  // { artifacts: [{ base64: "...", finishReason: "SUCCESS" }] }
  if (Array.isArray(payload.artifacts)) {
    for (const artifact of payload.artifacts) {
      if (
        isRecord(artifact) &&
        typeof artifact.base64 === "string" &&
        artifact.base64.trim()
      ) {
        return artifact.base64.trim();
      }
    }
  }

  // OpenAI-style fallback: { data: [{ b64_json: "..." }] }
  if (Array.isArray(payload.data)) {
    for (const item of payload.data) {
      if (
        isRecord(item) &&
        typeof item.b64_json === "string" &&
        item.b64_json.trim()
      ) {
        return item.b64_json.trim();
      }
    }
  }

  return null;
}

export async function generateNvidiaGenAIImage(input: {
  prompt: string;
  provider: NvidiaGenAIImageProvider;
  aspectRatio: MediaAspectRatio;
}) {
  const url = `${input.provider.baseUrl}/${input.provider.model}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.provider.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      prompt: input.prompt,
      cfg_scale: 3.5,
      aspect_ratio: getGenAIAspectRatio(input.aspectRatio),
      seed: 0,
      steps: 4,
      negative_prompt: "",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    const hint =
      response.status === 401
        ? "Check your NVIDIA_IMAGE_API_KEY."
        : response.status === 404
        ? `Model "${input.provider.model}" not found on NVIDIA GenAI. Set NVIDIA_GENAI_IMAGE_MODEL to a valid model (e.g. black-forest-labs/flux-schnell).`
        : errorText.slice(0, 300).trim() || "Unknown error.";
    throw new Error(`NVIDIA image generation failed (${response.status}). ${hint}`);
  }

  const payload = await response.json().catch(() => null);
  const base64 = extractGenAIBase64(payload);

  if (!base64) {
    throw new Error(
      "NVIDIA image generation did not return an image. The model may not be available."
    );
  }

  return {
    image: `data:image/png;base64,${base64}`,
    model: input.provider.model,
    provider: "nvidia" as const,
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


export function hasConfiguredMediaProvider(
  mode: MediaMode,
  requestedModel?: string
) {
  return Boolean(
    resolveNvidiaGenAIImageProvider(mode) ||
      resolveOpenAICompatibleMediaProvider(mode, requestedModel)
  );
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
  if (!hasNvidiaImageApiKey()) {
    return mode === "image-edit"
      ? "NVIDIA_IMAGE_API_KEY or NVIDIA_API_KEY is required for Qwen image editing."
      : "Add NVIDIA_IMAGE_API_KEY to website/.env.local to enable image generation.";
  }

  if (mode === "image-edit") {
    return (
      getNvidiaImageModelConfigError("image-edit", requestedModel) ??
      "NVIDIA Qwen image editing is misconfigured."
    );
  }

  if (mode === "video") {
    return "NVIDIA Cosmos video generation requires NVIDIA_COSMOS_INFER_URL or NVIDIA_COSMOS_BASE_URL.";
  }

  return getNvidiaImageModelConfigError("image", requestedModel) ?? "Configure NVIDIA_IMAGE_API_KEY or NVIDIA_API_KEY for image generation.";
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
    return `NVIDIA Qwen image generation failed (404). Verify NVIDIA_IMAGE_BASE_URL points to a valid endpoint or leave it unset to use the default NVIDIA API. Check model name: ${mode === "image-edit" ? DEFAULT_NVIDIA_IMAGE_EDIT_MODEL : DEFAULT_NVIDIA_IMAGE_MODEL}.`;
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
  if (!cleanBase64 || !/^[a-z0-9+/=]+$/i.test(cleanBase64)) {
    return null;
  }

  const kind = getGeneratedMediaKind(fallbackMediaType);
  const selectedMediaType = normalizeGeneratedMediaMimeType(
    mediaType,
    kind,
    fallbackMediaType
  );

  return `data:${selectedMediaType};base64,${cleanBase64}`;
}

function getGeneratedMediaKind(fallbackMediaType: string): GeneratedMediaKind {
  return fallbackMediaType.trim().toLowerCase().startsWith("video/")
    ? "video"
    : "image";
}

function normalizeGeneratedMediaItem(
  item: unknown,
  fallbackMediaType: string
) {
  const kind = getGeneratedMediaKind(fallbackMediaType);

  if (typeof item === "string") {
    const normalizedUrl = normalizeGeneratedMediaUrl(item, kind);
    if (normalizedUrl) {
      return normalizedUrl;
    }

    return normalizeBase64Media(item, fallbackMediaType, fallbackMediaType);
  }

  if (!isRecord(item)) {
    return null;
  }

  const record = item;

  if (typeof record.url === "string" && record.url.trim()) {
    return normalizeGeneratedMediaUrl(record.url, kind);
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

export function normalizeInputImageUrls(value: unknown) {
  const items = Array.isArray(value) ? value : value ? [value] : [];

  return items
    .flatMap((item) => {
      const url = normalizeGeneratedMediaUrl(item, "image");
      return url ? [url] : [];
    })
    .slice(0, 3);
}
