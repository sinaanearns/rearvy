import { isSafeGeneratedMediaMimeType } from "@/lib/chat/generated-media-url";

type UnknownRecord = Record<string, unknown>;

type IncomingMessagePart = {
  type?: unknown;
  text?: unknown;
  url?: unknown;
  data?: unknown;
  image?: unknown;
  mediaType?: unknown;
  filename?: unknown;
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function getMessageParts(message: unknown): IncomingMessagePart[] {
  if (!isRecord(message)) {
    return [];
  }

  const contentParts = Array.isArray(message.content) ? message.content : [];
  const messageParts = Array.isArray(message.parts) ? message.parts : [];
  const rawParts = contentParts.length > 0 ? contentParts : messageParts;

  return rawParts.filter(isRecord) as IncomingMessagePart[];
}

function getDataUrlBase64(value: string): string | null {
  const match = value.match(/^data:[^;,]+;base64,([\s\S]+)$/);
  return match ? match[1] : null;
}

function getDataUrlMediaType(value: string): string | null {
  const match = value.match(/^data:([^;,]+)[;,]/i);
  return match ? match[1] : null;
}

function isSafeImageMediaType(value: unknown) {
  return isSafeGeneratedMediaMimeType(value, "image");
}

function resolveSafeImageMediaType(part: IncomingMessagePart, source: string) {
  if (typeof part.mediaType === "string") {
    const mediaType = part.mediaType.trim().toLowerCase();
    return isSafeImageMediaType(mediaType) ? mediaType : null;
  }

  const dataUrlMediaType = getDataUrlMediaType(source);
  if (dataUrlMediaType) {
    const mediaType = dataUrlMediaType.trim().toLowerCase();
    return isSafeImageMediaType(mediaType) ? mediaType : null;
  }

  return "image/png";
}

function normalizeModelFileMediaType(part: IncomingMessagePart, source: string) {
  if (part.type === "image") {
    return resolveSafeImageMediaType(part, source) ?? "application/octet-stream";
  }

  if (typeof part.mediaType === "string") {
    const mediaType = part.mediaType.trim().toLowerCase();
    return mediaType.startsWith("image/") && !isSafeImageMediaType(mediaType)
      ? "application/octet-stream"
      : mediaType;
  }

  const dataUrlMediaType = getDataUrlMediaType(source);
  if (!dataUrlMediaType) {
    return null;
  }

  const mediaType = dataUrlMediaType.trim().toLowerCase();
  return mediaType.startsWith("image/") && !isSafeImageMediaType(mediaType)
    ? "application/octet-stream"
    : mediaType;
}

function getPartSource(part: IncomingMessagePart): string | null {
  if (typeof part.url === "string") {
    return part.url;
  }

  if (typeof part.data === "string") {
    return part.data;
  }

  if (typeof part.image === "string") {
    return part.image;
  }

  return null;
}

function normalizePartForModel(part: unknown): unknown {
  if (!isRecord(part) || typeof part.type !== "string") {
    return part;
  }

  if (part.type !== "file" && part.type !== "image") {
    return part;
  }

  const source = getPartSource(part as IncomingMessagePart);
  if (!source) {
    return part;
  }

  const mediaType = normalizeModelFileMediaType(
    part as IncomingMessagePart,
    source
  );

  const base64Payload = getDataUrlBase64(source);
  const normalizedUrl = base64Payload ?? source;

  return {
    ...part,
    type: "file",
    ...(mediaType ? { mediaType } : {}),
    ...(typeof part.filename === "string" ? { filename: part.filename } : {}),
    url: normalizedUrl,
  };
}

function countImageParts(parts: unknown[]): number {
  return parts.reduce<number>((count, part) => {
    if (!isRecord(part) || typeof part.type !== "string") {
      return count;
    }

    if (part.type === "image") {
      const source = getPartSource(part as IncomingMessagePart);
      return source && resolveSafeImageMediaType(part as IncomingMessagePart, source)
        ? count + 1
        : count;
    }

    if (
      part.type === "file" &&
      typeof part.mediaType === "string" &&
      isSafeImageMediaType(part.mediaType)
    ) {
      return count + 1;
    }

    return count;
  }, 0);
}

function countImageTokensInText(value: string): number {
  const matches = value.match(/<image>/g);
  return matches ? matches.length : 0;
}

function ensureImageTokenAlignment(parts: unknown[]): unknown[] {
  const imageCount = countImageParts(parts);
  if (imageCount === 0) {
    return parts;
  }

  let existingTokenCount = 0;
  let firstTextIndex = -1;

  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (!isRecord(part) || part.type !== "text" || typeof part.text !== "string") {
      continue;
    }

    if (firstTextIndex === -1) {
      firstTextIndex = i;
    }

    existingTokenCount += countImageTokensInText(part.text);
  }

  if (existingTokenCount >= imageCount) {
    return parts;
  }

  const missingTokenCount = imageCount - existingTokenCount;
  const tokenPrefix = Array.from({ length: missingTokenCount }, () => "<image>").join("\n");
  const nextParts = [...parts];

  if (firstTextIndex >= 0) {
    const firstTextPart = nextParts[firstTextIndex] as Record<string, unknown>;
    const firstText = String(firstTextPart.text ?? "");
    nextParts[firstTextIndex] = {
      ...firstTextPart,
      text: firstText ? `${tokenPrefix}\n${firstText}` : tokenPrefix,
    };
    return nextParts;
  }

  nextParts.unshift({ type: "text", text: tokenPrefix });
  return nextParts;
}

export function extractIncomingMessageText(message: unknown): string {
  if (isRecord(message) && typeof message.content === "string") {
    return message.content.trim();
  }

  return getMessageParts(message)
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => String(part.text).trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function messageHasImageParts(message: unknown): boolean {
  return getMessageParts(message).some((part) => {
    if (part.type === "image") {
      const source = getPartSource(part);
      return Boolean(source && resolveSafeImageMediaType(part, source));
    }

    return (
      part.type === "file" &&
      typeof part.mediaType === "string" &&
      isSafeImageMediaType(part.mediaType)
    );
  });
}

export function extractIncomingMessageImageSources(message: unknown): string[] {
  return getMessageParts(message)
    .map((part) => {
      if (part.type === "image") {
        const source = getPartSource(part);
        return source && resolveSafeImageMediaType(part, source)
          ? source
          : null;
      }

      if (
        part.type === "file" &&
        typeof part.mediaType === "string" &&
        isSafeImageMediaType(part.mediaType)
      ) {
        return getPartSource(part);
      }

      return null;
    })
    .filter((source): source is string => Boolean(source))
    .slice(0, 3);
}

export function buildUserMessageSummary(message: unknown): string {
  const text = extractIncomingMessageText(message);
  if (text) {
    return text;
  }

  let imageCount = 0;
  let fileCount = 0;

  for (const part of getMessageParts(message)) {
    if (part.type === "image") {
      const source = getPartSource(part);
      if (source && resolveSafeImageMediaType(part, source)) {
        imageCount += 1;
        continue;
      }
    }

    if (part.type === "file" && getPartSource(part)) {
      if (
        typeof part.mediaType === "string" &&
        isSafeImageMediaType(part.mediaType)
      ) {
        imageCount += 1;
      } else {
        fileCount += 1;
      }
    }
  }

  const summaryParts: string[] = [];
  if (imageCount > 0) {
    summaryParts.push(imageCount === 1 ? "1 image" : `${imageCount} images`);
  }
  if (fileCount > 0) {
    summaryParts.push(fileCount === 1 ? "1 file" : `${fileCount} files`);
  }

  return summaryParts.length > 0
    ? `Uploaded ${summaryParts.join(" and ")}`
    : "";
}

export function buildStoredUserMessageParts(message: unknown): unknown[] | null {
  const storedParts: unknown[] = [];

  for (const part of getMessageParts(message)) {
    if (part.type === "text" && typeof part.text === "string") {
      const text = part.text.trim();
      if (text) {
        storedParts.push({ type: "text", text });
      }
      continue;
    }

    if (part.type === "file") {
      const source = getPartSource(part);
      if (!source || typeof part.mediaType !== "string") {
        continue;
      }

      storedParts.push({
        type: "file",
        mediaType: part.mediaType,
        ...(typeof part.filename === "string" ? { filename: part.filename } : {}),
        url: source,
      });
      continue;
    }

    if (part.type === "image") {
      const source = getPartSource(part);
      if (!source) {
        continue;
      }

      const mediaType = resolveSafeImageMediaType(part, source);
      if (!mediaType) {
        continue;
      }

      storedParts.push({
        type: "file",
        mediaType,
        ...(typeof part.filename === "string" ? { filename: part.filename } : {}),
        url: source,
      });
    }
  }

  return storedParts.length > 0 ? storedParts : null;
}

export function normalizeIncomingMessagesForModel(messages: unknown[]): unknown[] {
  return messages.map((message) => {
    if (!isRecord(message)) {
      return message;
    }

    const sourceParts = Array.isArray(message.parts)
      ? message.parts
      : Array.isArray(message.content)
        ? message.content
        : null;

    if (!sourceParts) {
      return message;
    }

    const normalizedParts = sourceParts.map((part) => normalizePartForModel(part));
    const alignedParts =
      message.role === "user"
        ? ensureImageTokenAlignment(normalizedParts)
        : normalizedParts;

    return {
      ...message,
      parts: alignedParts,
      content: alignedParts,
    };
  });
}
