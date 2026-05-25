"use client";

import type { UIMessage } from "ai";
import Image from "next/image";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  ExternalLink,
  Layers,
  Loader2,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildAssistantTimelineEntries,
  getAssistantTimelineDurationLabel,
  getAssistantTimelineErrors,
  getAssistantTimelineMetadata,
  type AssistantTimelineEntry,
  type AssistantTimelinePreview,
  type AssistantTimelineStatus,
} from "@/lib/chat/assistant-timeline";

function statusLabel(status: AssistantTimelineStatus) {
  if (status === "running") {
    return "working";
  }

  if (status === "failed") {
    return "failed";
  }

  return "completed";
}

function StatusIcon({ status }: { status: AssistantTimelineStatus }) {
  if (status === "running") {
    return <Loader2 className="h-4 w-4 animate-spin text-sky-500" />;
  }

  if (status === "failed") {
    return <AlertTriangle className="h-4 w-4 text-rose-500" />;
  }

  return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
}

function TimelinePreview({ preview }: { preview: AssistantTimelinePreview }) {
  if (preview.kind === "media") {
    return (
      <div className="mt-3 flex min-w-0 flex-wrap gap-2">
        {preview.urls.map((url, index) => (
          <a
            key={`${url}-${index}`}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="group relative block h-16 w-16 overflow-hidden rounded-lg border border-border/70 bg-muted/60"
          >
            {preview.mediaType === "image" ? (
              <Image
                src={url}
                alt="Generated image preview"
                fill
                unoptimized
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Video className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
          </a>
        ))}
      </div>
    );
  }

  if (preview.kind === "links") {
    return (
      <div className="mt-3 flex min-w-0 flex-wrap gap-2">
        {preview.links.map((link) => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="truncate">{link.label}</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-3 max-w-full overflow-x-auto rounded-xl border border-border/60 bg-background/60">
      <table className="min-w-full border-collapse text-left text-xs">
        <thead className="bg-muted/50">
          <tr>
            {preview.columns.map((column) => (
              <th
                key={column}
                className="border-b border-border/50 px-3 py-2 font-medium text-muted-foreground"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-border/40 last:border-b-0">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="max-w-48 truncate px-3 py-2 text-foreground/80">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {preview.totalRows > preview.rows.length ? (
        <div className="border-t border-border/50 px-3 py-2 text-xs text-muted-foreground">
          {preview.totalRows - preview.rows.length} more rows
        </div>
      ) : null}
    </div>
  );
}

function TimelineEntryRow({
  entry,
  isExpanded,
  onToggle,
}: {
  entry: AssistantTimelineEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const hasDetails = Boolean(entry.inputDetail || entry.outputDetail);

  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-3",
        entry.status === "failed"
          ? "border-rose-500/30 bg-rose-500/5"
          : "border-border/60 bg-background/55"
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 shrink-0">
          <StatusIcon status={entry.status} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="truncate text-sm font-medium text-foreground">
                  {entry.label}
                </span>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                    entry.status === "running"
                      ? "border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-300"
                      : entry.status === "failed"
                        ? "border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-300"
                        : "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                  )}
                >
                  {statusLabel(entry.status)}
                </span>
              </div>
              {entry.summary ? (
                <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">
                  {entry.summary}
                </p>
              ) : null}
            </div>

            {hasDetails ? (
              <button
                type="button"
                onClick={onToggle}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border/60 bg-background/70 px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                Details
              </button>
            ) : null}
          </div>

          {entry.preview ? <TimelinePreview preview={entry.preview} /> : null}

          {isExpanded ? (
            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              <div>
                <div className="mb-1 text-[11px] font-medium uppercase text-muted-foreground">
                  Input
                </div>
                <pre className="max-h-80 overflow-auto rounded-lg border border-border/60 bg-background/80 p-3 text-[11px] leading-5 text-foreground">
                  {entry.inputDetail ?? "No input"}
                </pre>
              </div>
              <div>
                <div className="mb-1 text-[11px] font-medium uppercase text-muted-foreground">
                  Output
                </div>
                <pre className="max-h-80 overflow-auto rounded-lg border border-border/60 bg-background/80 p-3 text-[11px] leading-5 text-foreground">
                  {entry.outputDetail ??
                    (entry.status === "failed"
                      ? "Tool failed before it returned output."
                      : "No output")}
                </pre>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function AssistantTracePanel({
  parts,
  metadata,
  isLoading = false,
}: {
  parts: UIMessage["parts"];
  metadata?: UIMessage["metadata"];
  isLoading?: boolean;
}) {
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(() => new Set());
  const entries = useMemo(() => buildAssistantTimelineEntries(parts ?? []), [parts]);
  const errors = useMemo(() => getAssistantTimelineErrors(metadata), [metadata]);
  const timelineMetadata = useMemo(() => getAssistantTimelineMetadata(metadata), [metadata]);
  const durationLabel = getAssistantTimelineDurationLabel(metadata, isLoading);
  const shouldShowFallback = isLoading && entries.length === 0;
  const hasTimelineBody = entries.length > 0 || errors.length > 0 || shouldShowFallback;

  function toggleEntry(key: string) {
    setExpandedEntries((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <div className="w-full rounded-2xl border border-border/60 bg-card/65 p-4 shadow-sm backdrop-blur-md">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/80">
            <Bot className="h-4 w-4 text-sky-500" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">
              {timelineMetadata.agentName}
            </div>
            <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              <Layers className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{durationLabel}</span>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
            isLoading
              ? "border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-300"
              : errors.length > 0
                ? "border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-300"
                : "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
          )}
        >
          {isLoading ? (
            <CircleDashed className="h-3.5 w-3.5 animate-spin" />
          ) : errors.length > 0 ? (
            <AlertTriangle className="h-3.5 w-3.5" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          {isLoading ? "Live" : errors.length > 0 ? "Needs review" : "Done"}
        </div>
      </div>

      {hasTimelineBody ? (
        <div className="mt-4 space-y-2">
          {errors.length > 0 ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-700 dark:text-rose-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium">Tool issue</div>
                  <div className="mt-1 space-y-1 text-xs leading-5">
                    {errors.map((error) => (
                      <div key={`${error.toolName}-${error.errorCode}-${error.message}`}>
                        <span className="font-semibold">{error.toolName}</span>
                        {": "}
                        <span>{error.message}</span>
                        <span className="ml-1 opacity-70">({error.errorCode})</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {shouldShowFallback ? (
            <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/55 px-3 py-3">
              <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-sky-500" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">
                  Thinking through the request
                </div>
                <div className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  Reading context and preparing the next action.
                </div>
              </div>
            </div>
          ) : null}

          {entries.map((entry) => (
            <TimelineEntryRow
              key={entry.key}
              entry={entry}
              isExpanded={expandedEntries.has(entry.key)}
              onToggle={() => toggleEntry(entry.key)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
