import { normalizeHttpUrl } from "@/lib/chat/url-normalization";

const URL_CANDIDATE_PATTERN = /https?:\/\/[^\s<>"')\]]+/gi;
const TRAILING_PUNCTUATION_PATTERN = /[.,;:!?]+$/;

export function normalizeOpenableBrowserUrl(value: unknown) {
  return typeof value === "string" ? normalizeHttpUrl(value) : null;
}

export function extractFirstOpenableBrowserUrl(...values: unknown[]) {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const directUrl = normalizeOpenableBrowserUrl(value);
    if (directUrl) {
      return directUrl;
    }

    for (const match of value.matchAll(URL_CANDIDATE_PATTERN)) {
      const candidate = match[0].replace(TRAILING_PUNCTUATION_PATTERN, "");
      const url = normalizeOpenableBrowserUrl(candidate);
      if (url) {
        return url;
      }
    }
  }

  return null;
}
