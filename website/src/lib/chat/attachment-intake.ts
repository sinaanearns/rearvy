import {
  MAX_CHAT_ATTACHMENTS_PER_MESSAGE,
  MAX_CHAT_ATTACHMENT_SIZE_BYTES,
} from "./attachments";

export type ChatAttachmentCandidate = {
  name?: string;
  size: number;
};

export type ChatAttachmentRejectionReason = "limit" | "size";

export type ChatAttachmentRejection<TFile extends ChatAttachmentCandidate> = {
  file: TFile;
  reason: ChatAttachmentRejectionReason;
};

export function selectChatAttachmentFiles<TFile extends ChatAttachmentCandidate>(
  files: TFile[],
  existingCount = 0
) {
  const accepted: TFile[] = [];
  const rejected: Array<ChatAttachmentRejection<TFile>> = [];
  const remainingSlots = Math.max(
    0,
    MAX_CHAT_ATTACHMENTS_PER_MESSAGE - existingCount
  );

  for (const file of files) {
    if (accepted.length >= remainingSlots) {
      rejected.push({ file, reason: "limit" });
      continue;
    }

    if (file.size > MAX_CHAT_ATTACHMENT_SIZE_BYTES) {
      rejected.push({ file, reason: "size" });
      continue;
    }

    accepted.push(file);
  }

  return { accepted, rejected };
}
