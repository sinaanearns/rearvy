"use client";

import type { UIMessage } from "ai";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
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

const BROWSER_AUTOMATION_TOOL_NAMES = new Set([
  "runBrowserTask",
  "controlBrowserSession",
  "stopBrowserSession",
]);

function statusLabel(status: AssistantTimelineStatus) {
  if (status === "running") {
    return "in_progress";
  }

  if (status === "failed") {
    return "failed";
  }

  return "completed";
}

function StatusIcon({ status }: { status: AssistantTimelineStatus }) {
  if (status === "running") {
    return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
  }

  if (status === "failed") {
    return <AlertTriangle className="h-4 w-4 text-rose-500" />;
  }

  return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
}

function statusTextClass(status: AssistantTimelineStatus) {
  if (status === "running") {
    return "text-blue-600 dark:text-blue-300";
  }

  if (status === "failed") {
    return "text-rose-600 dark:text-rose-300";
  }

  return "text-emerald-600 dark:text-emerald-300";
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
            className="group relative block aspect-video w-44 overflow-hidden rounded-md border border-border/70 bg-muted/50 shadow-sm"
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
    <div className="mt-3 max-w-full overflow-x-auto rounded-md border border-border/60 bg-background/70">
      <table className="min-w-full border-collapse text-left text-xs">
        <thead className="bg-muted/45">
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
            <tr key={rowIndex} className="border-b border-border/35 last:border-b-0">
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
        "group border-b border-border/55 py-3 last:border-b-0",
        entry.status === "failed" && "rounded-md border border-rose-500/25 bg-rose-500/5 px-3"
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
          <StatusIcon status={entry.status} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="font-medium text-muted-foreground">
                  {entry.label}
                </span>
                <span className={cn("font-medium", statusTextClass(entry.status))}>
                  {statusLabel(entry.status)}
                </span>
                {entry.summary ? (
                  <span className="min-w-0 flex-1 truncate text-foreground/75">
                    {entry.summary}
                  </span>
                ) : null}
              </div>
            </div>

            {hasDetails ? (
              <button
                type="button"
                onClick={onToggle}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                aria-label={isExpanded ? `Collapse ${entry.label}` : `Expand ${entry.label}`}
                title={isExpanded ? "Collapse details" : "Expand details"}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            ) : null}
          </div>

          {entry.preview ? <TimelinePreview preview={entry.preview} /> : null}

          {isExpanded ? (
            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              <div>
                <div className="mb-1 text-[11px] font-semibold uppercase text-muted-foreground">
                  Input
                </div>
                <pre className="max-h-80 overflow-auto rounded-md border border-border/60 bg-muted/30 p-3 text-[11px] leading-5 text-foreground">
                  {entry.inputDetail ?? "No input"}
                </pre>
              </div>
              <div>
                <div className="mb-1 text-[11px] font-semibold uppercase text-muted-foreground">
                  Output
                </div>
                <pre className="max-h-80 overflow-auto rounded-md border border-border/60 bg-muted/30 p-3 text-[11px] leading-5 text-foreground">
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

function WorkingRow() {
  return (
    <div className="flex items-start gap-3 border-b border-border/55 py-3 last:border-b-0">
      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-muted-foreground">
          Thinking through the request
        </div>
        <div className="mt-0.5 text-xs leading-5 text-muted-foreground">
          Reading context and preparing the next action.
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
  const [isOpen, setIsOpen] = useState(false);
  const entries = useMemo(() => {
    const timelineEntries = buildAssistantTimelineEntries(parts ?? []);
    const hasBrowserAutomation = timelineEntries.some((entry) =>
      BROWSER_AUTOMATION_TOOL_NAMES.has(entry.toolName)
    );

    return hasBrowserAutomation
      ? timelineEntries.filter((entry) => entry.toolName !== "requestBrowserConnection")
      : timelineEntries;
  }, [parts]);
  const errors = useMemo(() => getAssistantTimelineErrors(metadata), [metadata]);
  const timelineMetadata = useMemo(() => getAssistantTimelineMetadata(metadata), [metadata]);
  const durationLabel = getAssistantTimelineDurationLabel(metadata, isLoading);
  const shouldShowFallback = isLoading && entries.length === 0;
  const hasTimelineBody = entries.length > 0 || errors.length > 0 || shouldShowFallback;
  const completedTasks = entries.filter((entry) => entry.status === "completed").length;
  const failedTasks = entries.filter((entry) => entry.status === "failed").length;
  const hasRunningTasks = isLoading || entries.some((entry) => entry.status === "running");

  useEffect(() => {
    setIsOpen(failedTasks > 0 || errors.length > 0 || hasRunningTasks);
  }, [errors.length, failedTasks, hasRunningTasks]);

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
    <div className="w-full min-w-0 text-foreground">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src="/favicon.png?v=20260529a"
              alt=""
              width={18}
              height={18}
              className="h-[18px] w-[18px] shrink-0 rounded-sm object-cover"
              unoptimized
            />
            <div className="truncate text-[15px] font-semibold text-foreground/85">
              {timelineMetadata.agentName}
            </div>
          </div>
          <div className="mt-5 flex min-w-0 items-center gap-2 text-sm font-medium text-muted-foreground">
            <Layers className="h-4 w-4 shrink-0" />
            <span className="truncate">{durationLabel}</span>
          </div>
        </div>

        {entries.length > 0 || hasTimelineBody ? (
          <div className="flex shrink-0 items-center gap-2">
            {entries.length > 0 ? (
              <div
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm",
                  failedTasks > 0 || errors.length > 0
                    ? "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-200"
                    : hasRunningTasks
                      ? "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-200"
                      : "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                )}
              >
                {failedTasks > 0 || errors.length > 0 ? (
                  <AlertTriangle className="h-3.5 w-3.5" />
                ) : hasRunningTasks ? (
                  <Circle className="h-3.5 w-3.5" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                <span>Tasks</span>
                <span>{completedTasks}/{entries.length}</span>
              </div>
            ) : null}
            {hasTimelineBody ? (
              <button
                type="button"
                onClick={() => setIsOpen((current) => !current)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                aria-label={isOpen ? "Hide work details" : "Show work details"}
                title={isOpen ? "Hide details" : "Show details"}
              >
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {hasTimelineBody && isOpen ? (
        <div className="mt-3 border-t border-border/60 pt-2">
          {errors.length > 0 ? (
            <div className="mb-2 rounded-md border border-rose-500/25 bg-rose-500/5 px-3 py-2 text-sm text-rose-700 dark:text-rose-200">
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

          {shouldShowFallback ? <WorkingRow /> : null}

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
