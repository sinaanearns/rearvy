import { sanitizeChatAttachmentName } from "./attachments";

const MAX_PATH_SEGMENT_LENGTH = 120;

export function sanitizeChatAttachmentPathSegment(value: string, fallback: string) {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, MAX_PATH_SEGMENT_LENGTH)
    .replace(/^[-_]+|[-_]+$/g, "");

  return cleaned || fallback;
}

export function buildChatAttachmentStoragePath(params: {
  chatId: string;
  id: string;
  fileName: string;
  timestamp?: number;
}) {
  const timestamp =
    typeof params.timestamp === "number" && Number.isFinite(params.timestamp) && params.timestamp > 0
      ? Math.trunc(params.timestamp)
      : Date.now();
  const chatSegment = sanitizeChatAttachmentPathSegment(params.chatId, "chat");
  const idSegment = sanitizeChatAttachmentPathSegment(params.id, "attachment");
  const fileName = sanitizeChatAttachmentName(params.fileName);

  return `chat-attachments/${chatSegment}/${timestamp}-${idSegment}-${fileName}`;
}
