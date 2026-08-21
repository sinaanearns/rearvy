const SAFE_SCREENSHOT_MEDIA_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const BASE64_PAYLOAD_PATTERN = /^[a-z0-9+/]+={0,2}$/i;

function normalizeBase64Payload(value) {
  const payload = String(value || "").replace(/\s/g, "");
  return payload && BASE64_PAYLOAD_PATTERN.test(payload) ? payload : "";
}

function normalizeScreenshotDataUrl(value) {
  if (typeof value !== "string") {
    return null;
  }

  const match = value.trim().match(/^data:([^;,]+);base64,([a-z0-9+/=\s]+)$/i);
  if (!match) {
    return null;
  }

  const mediaType = match[1].toLowerCase();
  if (!SAFE_SCREENSHOT_MEDIA_TYPES.has(mediaType)) {
    return null;
  }

  const payload = normalizeBase64Payload(match[2]);
  return payload ? `data:${mediaType};base64,${payload}` : null;
}

function normalizeScreenshotBase64(value) {
  const dataUrl = normalizeScreenshotDataUrl(value);
  if (dataUrl) {
    const commaIndex = dataUrl.indexOf(",");
    return commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : "";
  }

  return typeof value === "string" ? normalizeBase64Payload(value) : "";
}

function normalizeScreenshotInputDataUrl(value) {
  const dataUrl = normalizeScreenshotDataUrl(value);
  if (dataUrl) {
    return dataUrl;
  }

  const payload = normalizeScreenshotBase64(value);
  return payload ? `data:image/png;base64,${payload}` : null;
}

module.exports = {
  normalizeScreenshotBase64,
  normalizeScreenshotDataUrl,
  normalizeScreenshotInputDataUrl,
};
