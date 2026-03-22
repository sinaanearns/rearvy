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
      return Boolean(getPartSource(part));
    }

    return (
      part.type === "file" &&
      typeof part.mediaType === "string" &&
      part.mediaType.startsWith("image/")
    );
  });
}

export function buildUserMessageSummary(message: unknown): string {
  const text = extractIncomingMessageText(message);
  if (text) {
    return text;
  }

  let imageCount = 0;
  let fileCount = 0;

  for (const part of getMessageParts(message)) {
    if (part.type === "image" && getPartSource(part)) {
      imageCount += 1;
      continue;
    }

    if (part.type === "file" && getPartSource(part)) {
      if (
        typeof part.mediaType === "string" &&
        part.mediaType.startsWith("image/")
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

      const mediaType =
        typeof part.mediaType === "string"
          ? part.mediaType
          : getDataUrlMediaType(source) ?? "image/*";

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
    if (!isRecord(message) || !Array.isArray(message.parts)) {
      return message;
    }

    return {
      ...message,
      parts: message.parts.map((part) => {
        if (!isRecord(part) || part.type !== "file" || typeof part.url !== "string") {
          return part;
        }

        const base64Payload = getDataUrlBase64(part.url);
        if (!base64Payload) {
          return part;
        }

        return {
          ...part,
          url: base64Payload,
        };
      }),
    };
  });
}
