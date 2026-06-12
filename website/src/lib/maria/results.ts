import { normalizeWebSourceUrl } from "@/lib/chat/web-source-links";

export type MariaResult = {
  title: string;
  url: string;
  description: string;
  summary: string;
};

function readString(value: unknown, maxLength = 1000) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeMariaResult(value: unknown): MariaResult | null {
  if (!isRecord(value)) {
    return null;
  }

  const url = normalizeWebSourceUrl(readString(value.url, 2000)) ?? "";
  const title = readString(value.title, 240) || (url ? new URL(url).hostname : "");
  const description = readString(value.description, 1200);
  const summary = readString(value.summary, 1200);

  if (!title && !description && !summary && !url) {
    return null;
  }

  return {
    title: title || "Untitled result",
    url,
    description,
    summary,
  };
}

export function normalizeMariaResults(value: unknown, limit = 5): MariaResult[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((result) => normalizeMariaResult(result))
    .filter((result): result is MariaResult => result !== null)
    .slice(0, limit);
}
