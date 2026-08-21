import { normalizeHttpUrl } from "./url-normalization";

export type GeneratedMediaKind = "image" | "video";

const DEFAULT_GENERATED_MEDIA_TYPE: Record<GeneratedMediaKind, string> = {
  image: "image/png",
  video: "video/mp4",
};

const SAFE_DATA_MEDIA_TYPES: Record<GeneratedMediaKind, Set<string>> = {
  image: new Set(["image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"]),
  video: new Set(["video/mp4", "video/ogg", "video/quicktime", "video/webm"]),
};

function normalizeDataMediaUrl(value: string, kind: GeneratedMediaKind) {
  const match = value.match(/^data:([^;,]+);base64,([a-z0-9+/=\s]+)$/i);
  if (!match) {
    return null;
  }

  const mediaType = match[1].toLowerCase();
  if (!SAFE_DATA_MEDIA_TYPES[kind].has(mediaType)) {
    return null;
  }

  const payload = match[2].replace(/\s/g, "");
  return payload ? `data:${mediaType};base64,${payload}` : null;
}

export function normalizeGeneratedMediaUrl(
  value: unknown,
  kind: GeneratedMediaKind
) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.toLowerCase().startsWith("data:")) {
    return normalizeDataMediaUrl(trimmed, kind);
  }

  return normalizeHttpUrl(trimmed);
}

export function normalizeGeneratedMediaUrls(
  values: unknown,
  kind: GeneratedMediaKind
) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.flatMap((value) => {
    const url = normalizeGeneratedMediaUrl(value, kind);
    return url ? [url] : [];
  });
}

export function normalizeGeneratedMediaMimeType(
  value: unknown,
  kind: GeneratedMediaKind,
  fallback = DEFAULT_GENERATED_MEDIA_TYPE[kind]
) {
  const normalized =
    typeof value === "string" ? value.trim().toLowerCase() : "";
  const fallbackType = fallback.trim().toLowerCase();

  if (SAFE_DATA_MEDIA_TYPES[kind].has(normalized)) {
    return normalized;
  }

  return SAFE_DATA_MEDIA_TYPES[kind].has(fallbackType)
    ? fallbackType
    : DEFAULT_GENERATED_MEDIA_TYPE[kind];
}

export function isSafeGeneratedMediaMimeType(
  value: unknown,
  kind: GeneratedMediaKind
) {
  return (
    typeof value === "string" &&
    SAFE_DATA_MEDIA_TYPES[kind].has(value.trim().toLowerCase())
  );
}
