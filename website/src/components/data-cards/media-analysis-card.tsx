"use client";

import { AlertCircle, Captions, ExternalLink, FileText, Radio } from "lucide-react";

import { DataCardFrame, DataCardMessage } from "./data-card-frame";

type MediaAnalysisCardProps = {
  data: Record<string, unknown>;
};

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readBoolean(value: unknown) {
  return value === true;
}

function formatLabel(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function MediaAnalysisCard({ data }: MediaAnalysisCardProps) {
  const ok = data.ok !== false;
  const title = readString(data.title) || "Media analysis";
  const url = readString(data.url);
  const source = readString(data.source);
  const authorName = readString(data.authorName);
  const summary = readString(data.summary);
  const transcript = readString(data.transcript);
  const message = readString(data.message);
  const task = readString(data.task) || "analyze";
  const mediaType = readString(data.mediaType) || "media";
  const transcriptAvailable = readBoolean(data.transcriptAvailable);
  const transcriptionStatus = readString(data.transcriptionStatus);

  if (!ok) {
    return (
      <DataCardMessage
        icon={AlertCircle}
        title="Media analysis failed"
        tone="rose"
        message={message || "I could not analyze this media link."}
      />
    );
  }

  const summaryParagraphs = summary
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .slice(0, 5);
  const statusLabel =
    transcriptionStatus === "requires_desktop_bridge"
      ? "Desktop transcription required"
      : transcriptionStatus === "transcribed_with_assemblyai"
        ? "Transcribed with AssemblyAI"
      : transcriptAvailable
        ? "Transcript evidence found"
        : "Metadata/page evidence";
  const transcriptPreview =
    transcript.length > 1800 ? `${transcript.slice(0, 1800).trim()}...` : transcript;

  return (
    <DataCardFrame
      icon={mediaType === "audio" ? Radio : FileText}
      title={title}
      subtitle={`${formatLabel(task)} - ${formatLabel(mediaType)}`}
      tone="cyan"
      className="max-w-2xl animate-in fade-in zoom-in duration-300"
      accessory={
        url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Open media source"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        ) : null
      }
    >
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-[8px] border border-border/70 bg-background/78 p-3 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs font-medium text-muted-foreground">Source</p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">
            {source || "Public link"}
          </p>
        </div>
        <div className="rounded-[8px] border border-border/70 bg-background/78 p-3 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs font-medium text-muted-foreground">Creator</p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">
            {authorName || "Unknown"}
          </p>
        </div>
        <div className="rounded-[8px] border border-border/70 bg-background/78 p-3 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs font-medium text-muted-foreground">Transcript</p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">
            {statusLabel}
          </p>
        </div>
      </div>

      {message ? (
        <div className="flex items-start gap-2 rounded-[8px] border border-border/70 bg-muted/30 p-3 text-sm leading-6 text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]">
          <Captions className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{message}</span>
        </div>
      ) : null}

      {summaryParagraphs.length > 0 ? (
        <div className="space-y-3 rounded-[8px] border border-border/70 bg-background/78 p-3 text-sm leading-6 text-foreground/90 dark:border-white/10 dark:bg-white/[0.04]">
          {summaryParagraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      ) : null}

      {transcriptPreview ? (
        <div className="rounded-[8px] border border-border/70 bg-muted/30 p-3 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
            Transcript excerpt
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/90">
            {transcriptPreview}
          </p>
        </div>
      ) : null}
    </DataCardFrame>
  );
}
