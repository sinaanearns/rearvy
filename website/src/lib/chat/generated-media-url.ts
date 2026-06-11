import { normalizeHttpUrl } from "./url-normalization";

export type GeneratedMediaKind = "image" | "video";

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
