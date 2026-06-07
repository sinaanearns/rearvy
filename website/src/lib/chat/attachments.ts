export type ChatAttachment = {
  id: string;
  name: string;
  contentType: string;
  size: number;
  url: string;
  storagePath: string;
  kind: "image" | "file";
};

export const MAX_CHAT_ATTACHMENTS_PER_MESSAGE = 5;
export const MAX_CHAT_ATTACHMENT_SIZE_BYTES = 15 * 1024 * 1024;

function toNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function toFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isImageContentType(contentType: string | null | undefined) {
  return typeof contentType === "string" && /^image\//i.test(contentType);
}

export function sanitizeChatAttachmentName(name: string) {
  const normalized = name.replace(/[/\\?%*:|"<>]/g, "-").trim();
  return normalized.length > 0 ? normalized : "attachment";
}

function normalizeChatAttachment(value: unknown): ChatAttachment | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = toNonEmptyString(value.id);
  const name = toNonEmptyString(value.name);
  const contentType = toNonEmptyString(value.contentType);
  const size = toFiniteNumber(value.size);
  const url = toNonEmptyString(value.url);
  const storagePath = toNonEmptyString(value.storagePath);
  const kindValue = toNonEmptyString(value.kind);

  if (!id || !name || !contentType || size === null || !url || !storagePath) {
    return null;
  }

  const kind =
    kindValue === "image" || kindValue === "file"
      ? kindValue
      : isImageContentType(contentType)
        ? "image"
        : "file";

  return {
    id,
    name,
    contentType,
    size,
    url,
    storagePath,
    kind,
  };
}

export function normalizeChatAttachments(value: unknown): ChatAttachment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((attachment) => normalizeChatAttachment(attachment))
    .filter((attachment): attachment is ChatAttachment => attachment !== null)
    .slice(0, MAX_CHAT_ATTACHMENTS_PER_MESSAGE);
}

export function buildChatMessagePreview(messageLike: {
  content?: unknown;
  attachments?: unknown;
}) {
  const content =
    typeof messageLike.content === "string" ? messageLike.content.trim() : "";

  if (content) {
    return content;
  }

  const attachments = normalizeChatAttachments(messageLike.attachments);
  if (attachments.length === 0) {
    return "";
  }

  if (attachments.length === 1) {
    return attachments[0].kind === "image"
      ? "Sent an image"
      : `Sent ${attachments[0].name}`;
  }

  const imageCount = attachments.filter((attachment) => attachment.kind === "image").length;
  if (imageCount === attachments.length) {
    return `Sent ${attachments.length} images`;
  }

  return `Sent ${attachments.length} attachments`;
}

export function formatChatAttachmentSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) {
    return "";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const rounded = value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1);
  return `${rounded} ${units[unitIndex]}`;
}
