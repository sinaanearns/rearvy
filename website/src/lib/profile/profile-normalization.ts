import { normalizeGeneratedMediaUrl } from "@/lib/chat/generated-media-url";
import { normalizeHttpUrl } from "@/lib/chat/url-normalization";

export const PROFILE_PROJECT_LINK_LIMIT = 20;
export const SAFE_PROFILE_AVATAR_MIME_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function readProjectLinkCandidates(value: unknown) {
  const rawItems = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : typeof value === "string"
      ? [value]
      : [];

  return rawItems.flatMap((item) =>
    item
      .split(/\r?\n/)
      .map((part) => part.trim())
      .filter(Boolean)
  );
}

export function normalizeProfileProjectLinks(
  value: unknown,
  limit = PROFILE_PROJECT_LINK_LIMIT
) {
  const links = new Set<string>();

  for (const candidate of readProjectLinkCandidates(value)) {
    const normalized = normalizeHttpUrl(candidate);
    if (normalized) {
      links.add(normalized);
    }

    if (links.size >= limit) {
      break;
    }
  }

  return Array.from(links);
}

export function normalizeProfileAvatarUrl(value: unknown) {
  return normalizeGeneratedMediaUrl(value, "image");
}

export function isSafeProfileAvatarMimeType(value: unknown) {
  return (
    typeof value === "string" &&
    SAFE_PROFILE_AVATAR_MIME_TYPES.has(value.trim().toLowerCase())
  );
}
