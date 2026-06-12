import { normalizeHttpUrl } from "./url-normalization";

const BARE_URL_TRAILING_PUNCTUATION = new Set([",", ".", ";", "!", "?"]);

export type BareMarkdownUrlToken = {
  hrefText: string;
  suffix: string;
};

export function splitBareMarkdownUrlToken(value: string): BareMarkdownUrlToken {
  let hrefEnd = value.length;

  while (
    hrefEnd > 0 &&
    BARE_URL_TRAILING_PUNCTUATION.has(value[hrefEnd - 1])
  ) {
    hrefEnd -= 1;
  }

  let hrefText = value.slice(0, hrefEnd);
  let suffix = value.slice(hrefEnd);

  while (hrefText.endsWith(")")) {
    const openParenCount = (hrefText.match(/\(/g) ?? []).length;
    const closeParenCount = (hrefText.match(/\)/g) ?? []).length;

    if (closeParenCount <= openParenCount) {
      break;
    }

    hrefText = hrefText.slice(0, -1);
    suffix = `)${suffix}`;
  }

  return { hrefText, suffix };
}

function normalizeLocalMarkdownHref(value: string) {
  if (
    value.startsWith("//") ||
    /[\x00-\x1f\x7f\\]/.test(value)
  ) {
    return null;
  }

  const rawPath = value.split(/[?#]/, 1)[0] ?? "";
  for (const segment of rawPath.split("/")) {
    if (!segment) {
      continue;
    }

    try {
      const decodedSegment = decodeURIComponent(segment);
      if (
        decodedSegment === "." ||
        decodedSegment === ".." ||
        decodedSegment.includes("/") ||
        decodedSegment.includes("\\") ||
        /[\x00-\x1f\x7f]/.test(decodedSegment)
      ) {
        return null;
      }
    } catch {
      return null;
    }
  }

  try {
    const parsed = new URL(value, "https://rearvy.local");

    if (parsed.origin !== "https://rearvy.local") {
      return null;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function normalizeMarkdownHref(value: string) {
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) {
    return null;
  }

  if (trimmed.startsWith("/")) {
    return normalizeLocalMarkdownHref(trimmed);
  }

  const schemeMatch = trimmed.match(/^([a-z][a-z0-9+.-]*):/i);
  if (schemeMatch && !/^https?:$/i.test(schemeMatch[0])) {
    return null;
  }

  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  return normalizeHttpUrl(candidate);
}
