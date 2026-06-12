import {
  isSafeGeneratedMediaMimeType,
  normalizeGeneratedMediaUrl,
  type GeneratedMediaKind,
} from "./generated-media-url";

export type RenderableMessageAssetKind = GeneratedMediaKind;

function readAssetSource(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (value instanceof URL) {
    return value.toString();
  }

  return null;
}

export function normalizeRenderableMessageAssetSrc(
  value: unknown,
  kind: RenderableMessageAssetKind
) {
  const source = readAssetSource(value);
  return source ? normalizeGeneratedMediaUrl(source, kind) : null;
}

export function getRenderableMessageFileKind(value: unknown) {
  if (isSafeGeneratedMediaMimeType(value, "image")) {
    return "image" as const;
  }

  if (isSafeGeneratedMediaMimeType(value, "video")) {
    return "video" as const;
  }

  return null;
}
