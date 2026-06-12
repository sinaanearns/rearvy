import {
  sanitizeCloudComputerFileName,
  sanitizeCloudComputerPathSegment,
} from "./artifacts";

function unquoteHeaderValue(value: string) {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed
      .slice(1, -1)
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }

  return trimmed;
}

function decodeFilenameStar(value: string) {
  const unquoted = unquoteHeaderValue(value);
  const encoded = /^([^']*)'[^']*'(.*)$/i.exec(unquoted)?.[2] || unquoted;

  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

export function extractBrowserbaseDownloadFilename(value: string | null) {
  if (!value) {
    return null;
  }

  const filenameStar = /(?:^|;)\s*filename\*\s*=\s*([^;]+)/i.exec(value)?.[1];
  const rawFileName = filenameStar
    ? decodeFilenameStar(filenameStar)
    : /(?:^|;)\s*filename\s*=\s*("(?:[^"\\]|\\.)*"|[^;]+)/i.exec(value)?.[1];
  if (!rawFileName) {
    return null;
  }

  const fileName = sanitizeCloudComputerFileName(unquoteHeaderValue(rawFileName));
  return fileName === "artifact" ? null : fileName;
}

export function buildBrowserbaseDownloadsFallbackFileName(providerSessionId: string) {
  return `browserbase-downloads-${sanitizeCloudComputerPathSegment(providerSessionId, "session")}.zip`;
}
