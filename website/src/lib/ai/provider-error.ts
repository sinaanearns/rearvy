import { parseJsonRecordFromText } from "@/lib/ai/json-object";
import { isRecord } from "@/lib/api/request-body";

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function readProviderError(value: unknown): string {
  if (typeof value === "string") {
    return readString(value);
  }

  if (!isRecord(value)) {
    return "";
  }

  return readString(value.message) || readString(value.detail);
}

export function parseProviderErrorText(
  text: string,
  fallback: string
): string {
  const trimmed = text.trim();
  const record = parseJsonRecordFromText(trimmed);

  if (!record) {
    return trimmed || fallback;
  }

  return (
    readProviderError(record.error) ||
    readString(record.message) ||
    readString(record.detail) ||
    readString(record.reason) ||
    trimmed ||
    fallback
  );
}

export async function parseProviderErrorResponse(
  response: Response,
  providerName: string
) {
  const text = await response.text();
  return parseProviderErrorText(
    text,
    `${providerName} request failed with ${response.status}`
  );
}
