import { normalizeGeneratedMediaUrl } from "./generated-media-url";

const BASE64_PAYLOAD_PATTERN = /^[a-z0-9+/]+={0,2}$/i;

function normalizeBase64Payload(value: string) {
  const payload = value.replace(/\s/g, "");
  return payload && BASE64_PAYLOAD_PATTERN.test(payload) ? payload : null;
}

export function normalizeScreenshotDataUrl(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const url = normalizeGeneratedMediaUrl(value, "image");
  return url?.toLowerCase().startsWith("data:image/") ? url : null;
}

export function hasScreenshotDataUrl(value: unknown) {
  return normalizeScreenshotDataUrl(value) !== null;
}

export function normalizeScreenshotBase64(value: unknown) {
  const dataUrl = normalizeScreenshotDataUrl(value);
  if (dataUrl) {
    const commaIndex = dataUrl.indexOf(",");
    return commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : "";
  }

  return typeof value === "string" ? normalizeBase64Payload(value) ?? "" : "";
}

export function normalizeScreenshotInputDataUrl(value: unknown) {
  const dataUrl = normalizeScreenshotDataUrl(value);
  if (dataUrl) {
    return dataUrl;
  }

  const payload = normalizeScreenshotBase64(value);
  return payload ? `data:image/png;base64,${payload}` : null;
}
