"use client";

import { Download, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type ChatAttachment,
  formatChatAttachmentPreviewBackgroundImage,
  formatChatAttachmentSize,
  isImageContentType,
  normalizeChatAttachmentUrl,
} from "@/lib/chat/attachments";

type ChatAttachmentListProps = {
  attachments: ChatAttachment[];
  tone?: "outgoing" | "incoming";
  className?: string;
};

export function ChatAttachmentList({
  attachments,
  tone = "incoming",
  className,
}: ChatAttachmentListProps) {
  if (attachments.length === 0) {
    return null;
  }

  const outgoing = tone === "outgoing";

  return (
    <div
      className={cn("flex flex-col gap-2", outgoing ? "items-end" : "items-start", className)}
    >
      {attachments.map((attachment) => {
        const safeUrl = normalizeChatAttachmentUrl(attachment.url);
        if (!safeUrl) {
          return null;
        }

        return isImageContentType(attachment.contentType) ? (
          <a
            key={attachment.id}
            href={safeUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "inline-flex w-[min(18rem,100%)] flex-col overflow-hidden rounded-[8px] border transition hover:border-white/15",
              outgoing ? "border-white/10 bg-white/10" : "border-white/8 bg-black/20"
            )}
          >
            <span
              role="img"
              aria-label={attachment.name}
              className="block aspect-square w-full bg-black/25 bg-contain bg-center bg-no-repeat"
              style={{
                backgroundImage: formatChatAttachmentPreviewBackgroundImage(safeUrl),
              }}
            />
            <div
              className={cn(
                "flex min-w-0 items-center justify-between gap-3 px-3 py-2 text-xs",
                outgoing ? "text-white/80" : "text-white/60"
              )}
            >
              <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
              <span className="shrink-0">{formatChatAttachmentSize(attachment.size)}</span>
            </div>
          </a>
        ) : (
          <a
            key={attachment.id}
            href={safeUrl}
            target="_blank"
            rel="noreferrer"
            download={attachment.name}
            className={cn(
              "flex w-[min(18rem,100%)] max-w-full items-center gap-3 rounded-[8px] border px-3 py-3 transition hover:border-white/15",
              outgoing ? "border-white/10 bg-white/10" : "border-white/8 bg-black/20"
            )}
          >
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px]",
                outgoing ? "bg-white/12 text-white" : "bg-white/8 text-white/80"
              )}
            >
              <FileText className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-white">{attachment.name}</span>
              <span className={cn("block text-xs", outgoing ? "text-white/70" : "text-white/50")}>
                {formatChatAttachmentSize(attachment.size) || "File"}
              </span>
            </span>
            <Download className={cn("h-4 w-4 shrink-0", outgoing ? "text-white/80" : "text-white/50")} />
          </a>
        );
      })}
    </div>
  );
}
