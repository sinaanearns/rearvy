"use client";

import { AlertCircle, Download, ExternalLink, FileText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  type GeneratedDocumentFile,
  type GeneratedDocumentFormat,
} from "@/lib/ai/document-generation";
import { DataCardFrame, DataCardMessage } from "./data-card-frame";

type DocumentCardData = {
  ok: boolean;
  title?: string;
  summary?: string;
  markdown?: string;
  files?: GeneratedDocumentFile[];
  message?: string;
};

type DocumentCardProps = {
  data: Record<string, unknown>;
};

const VIEWABLE_FORMATS = new Set<GeneratedDocumentFormat>([
  "pdf",
  "markdown",
  "txt",
  "html",
]);

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isGeneratedDocumentFormat(value: unknown): value is GeneratedDocumentFormat {
  return (
    value === "pdf" ||
    value === "docx" ||
    value === "markdown" ||
    value === "txt" ||
    value === "html"
  );
}

function isGeneratedDocumentFile(value: unknown): value is GeneratedDocumentFile {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isGeneratedDocumentFormat(value.format) &&
    typeof value.label === "string" &&
    typeof value.fileName === "string" &&
    typeof value.mimeType === "string" &&
    typeof value.base64 === "string" &&
    typeof value.sizeBytes === "number"
  );
}

function parseDocumentCardData(data: Record<string, unknown>): DocumentCardData {
  return {
    ok: data.ok === true,
    title: readString(data.title),
    summary: readString(data.summary),
    markdown: readString(data.markdown),
    message: readString(data.message),
    files: Array.isArray(data.files)
      ? data.files.filter(isGeneratedDocumentFile)
      : [],
  };
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function base64ToBlob(file: GeneratedDocumentFile) {
  const binary = window.atob(file.base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: file.mimeType });
}

function showFileActionError(action: "download" | "open", fileName: string) {
  toast.error(`Could not ${action} ${fileName}. Please try generating it again.`);
}

function downloadGeneratedFile(file: GeneratedDocumentFile) {
  try {
    const url = URL.createObjectURL(base64ToBlob(file));
    const link = document.createElement("a");

    link.href = url;
    link.download = file.fileName;
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    showFileActionError("download", file.fileName);
  }
}

function openGeneratedFile(file: GeneratedDocumentFile) {
  try {
    const url = URL.createObjectURL(base64ToBlob(file));
    const openedWindow = window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);

    if (!openedWindow) {
      toast.error(`Could not open ${file.fileName}. Check pop-up permissions.`);
    }
  } catch {
    showFileActionError("open", file.fileName);
  }
}

function previewFromMarkdown(markdown: string) {
  return markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .slice(0, 3)
    .join(" ");
}

export function DocumentCard({ data }: DocumentCardProps) {
  const parsed = parseDocumentCardData(data);

  if (!parsed.ok) {
    return (
      <DataCardMessage
        icon={AlertCircle}
        title="Document failed"
        tone="rose"
        message={parsed.message || "Document generation returned an error."}
      />
    );
  }

  const files = parsed.files || [];
  const title = parsed.title || "Generated document";
  const preview = parsed.summary || previewFromMarkdown(parsed.markdown || "");

  return (
    <DataCardFrame
      icon={FileText}
      title={title}
      subtitle={`${files.length} file${files.length === 1 ? "" : "s"} ready`}
      tone="emerald"
      className="max-w-2xl animate-in fade-in zoom-in duration-300"
    >
      {preview ? (
        <div className="rounded-[8px] border border-border/70 bg-muted/30 p-3 text-sm leading-6 text-foreground/90 dark:border-white/10 dark:bg-white/[0.04]">
          {preview}
        </div>
      ) : null}

      <div className="space-y-2">
        {files.length > 0 ? (
          files.map((file) => (
            <div
              key={`${file.format}-${file.fileName}`}
              className="flex min-w-0 items-center justify-between gap-3 rounded-[8px] border border-border/70 bg-background/80 p-3 dark:border-white/10 dark:bg-white/[0.04]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-200">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {file.label}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {file.fileName} - {formatBytes(file.sizeBytes)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {VIEWABLE_FORMATS.has(file.format) ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={`Open ${file.fileName}`}
                        onClick={() => openGeneratedFile(file)}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Open</TooltipContent>
                  </Tooltip>
                ) : null}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={`Download ${file.fileName}`}
                      onClick={() => downloadGeneratedFile(file)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Download</TooltipContent>
                </Tooltip>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-[8px] border border-dashed border-border/70 bg-muted/30 p-3 text-sm text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]">
            No files were returned.
          </div>
        )}
      </div>
    </DataCardFrame>
  );
}
