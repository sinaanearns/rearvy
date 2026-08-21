"use client";

import type { UIMessage } from "ai";
import Image from "next/image";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  ExternalLink,
  Loader2,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildAssistantTimelineEntries,
  buildAssistantTaskPanelState,
  getAssistantTimelineErrors,
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
  if (status === "pending") {
    return "pending";
  }

  if (status === "running") {
    return "working";
  }

  if (status === "failed") {
    return "failed";
  }

  return "completed";
}

function StatusIcon({ status }: { status: AssistantTimelineStatus }) {
  if (status === "pending") {
    return <Circle className="h-4 w-4 text-muted-foreground" />;
  }

  if (status === "running") {
    return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
  }

  if (status === "failed") {
    return <AlertTriangle className="h-4 w-4 text-rose-500" />;
  }

  return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
}

function statusTextClass(status: AssistantTimelineStatus) {
  if (status === "pending") {
    return "text-muted-foreground";
  }

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
            rel="noopener noreferrer"
            className="group relative block aspect-video w-44 overflow-hidden rounded-[8px] border border-border/70 bg-muted/50 shadow-sm"
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
            rel="noopener noreferrer"
            className="inline-flex max-w-full items-center gap-1 rounded-[8px] border border-border/70 bg-background/70 px-2.5 py-1 text-xs text-muted-foreground shadow-sm transition-colors hover:text-foreground"
          >
            <span className="truncate">{link.label}</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        ))}
      </div>
    );
  }
  if (preview.kind === "map") {
    return (
      <Image
        src={`https://staticmap.openstreetmap.de/staticmap.php?center=${preview.viewport.center[1]},${preview.viewport.center[0]}&zoom=${preview.viewport.zoom}&size=400x300&markers=${preview.viewport.center[1]},${preview.viewport.center[0]},red-pushpin`}
        alt={`Map for ${preview.focus ?? preview.title}`}
        width={400}
        height={300}
        unoptimized
        className="mt-3 h-auto w-full max-w-[400px] rounded-[8px] border border-border/70 bg-background/70 shadow-sm"
      />
    );
  }

  return (
    <div className="mt-3 max-w-full overflow-x-auto rounded-[8px] border border-border/60 bg-background/70 shadow-sm">
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
        "group py-1.5",
        entry.status === "failed" && "text-rose-700 dark:text-rose-200"
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
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
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
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  Input
                </div>
                <pre className="max-h-80 overflow-auto p-0 text-[11px] leading-5 text-foreground">
                  {entry.inputDetail ?? "No input"}
                </pre>
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  Output
                </div>
                <pre className="max-h-80 overflow-auto p-0 text-[11px] leading-5 text-foreground">
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

function TaskSection({
  title,
  count,
  children,
}: {
  title: string;
  count: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      {children}
    </section>
  );
}

function CompactTaskRow({ entry }: { entry: AssistantTimelineEntry }) {
  return (
    <div className="flex min-w-0 items-start gap-2 text-sm">
      <span className="mt-0.5 shrink-0">
        <StatusIcon status={entry.status} />
      </span>
      <div className="min-w-0">
        <div className="truncate font-medium text-foreground/90">{entry.label}</div>
        {entry.summary ? (
          <div className="truncate text-xs text-muted-foreground">{entry.summary}</div>
        ) : null}
      </div>
    </div>
  );
}


export function AssistantTracePanel({
  parts,
  metadata,
  isLoading = false,
  analysisMessage,
  historyReasoning,
}: {
  parts: UIMessage["parts"];
  metadata?: UIMessage["metadata"];
  isLoading?: boolean;
  analysisMessage?: string | null;
  historyReasoning?: string | null;
}) {
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(() => new Set());
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);

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
  const shouldShowSkeleton = isLoading && entries.length === 0 && errors.length === 0;
  const hasTimelineBody = entries.length > 0 || errors.length > 0 || Boolean(historyReasoning) || isLoading;

  const taskState = useMemo(() => buildAssistantTaskPanelState(entries), [entries]);
  const defaultAnalysisMessage =
    taskState.failedCount > 0 || errors.length > 0
      ? "Execution needs attention."
      : taskState.completedCount > 0
        ? "Completed work is up to date."
        : "Preparing execution…";
  const conciseAnalysisMessage = analysisMessage || defaultAnalysisMessage;

  const isCurrentTaskRunning = entries.some((entry) => entry.status === "running");
  const totalEventCount =
    entries.length + (isLoading && !isCurrentTaskRunning ? 1 : 0);

  useEffect(() => {
    if (taskState.failedCount > 0 || errors.length > 0 || isLoading) {
      setIsHistoryOpen(true);
    }
  }, [errors.length, taskState.failedCount, isLoading]);

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

  if (shouldShowSkeleton) {
    return null;
  }

  if (!hasTimelineBody) {
    return null;
  }

  return (
    <div className="w-full min-w-0 text-foreground">
      <div className="w-full">
        <button
          type="button"
          onClick={() => setIsHistoryOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-3 text-left text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          aria-expanded={isHistoryOpen}
        >
          <div className="flex items-center gap-2">
            <span>Execution Log</span>
            {conciseAnalysisMessage ? (
              <span className="font-normal text-foreground/75">
                • {conciseAnalysisMessage}
              </span>
            ) : null}
          </div>
          <span className="flex items-center gap-2 font-normal">
            {totalEventCount} {totalEventCount === 1 ? "event" : "events"}
            {isHistoryOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </span>
        </button>

        {isHistoryOpen ? (
          <div className="mt-3 space-y-1">
            {errors.length > 0 ? (
              <div className="mb-2 rounded-[8px] border border-rose-500/25 bg-rose-500/5 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium">Tool issue</div>
                    <div className="mt-1 space-y-1 text-xs leading-5">
                      {errors.map((error) => (
                        <div
                          key={`${error.toolName}-${error.errorCode}-${error.message}`}
                        >
                          <span className="font-semibold">{error.toolName}</span>
                          {": "}
                          <span>{error.message}</span>
                          <span className="ml-1 opacity-70">
                            ({error.errorCode})
                          </span>
                        </div>
                      ))}
                    </div>
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

            {isLoading && !isCurrentTaskRunning ? (
              <div className="group py-1.5">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-x-2 text-sm">
                      <span className="font-medium text-muted-foreground">
                        Current Task
                      </span>
                      <span className="font-medium text-blue-600 dark:text-blue-300">
                        working
                      </span>
                      <span className="truncate text-foreground/75">
                        Processing next task…
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {historyReasoning ? (
              <div className="mt-2 rounded-[8px] border border-border/55 bg-background/55 p-3 text-xs leading-5 text-muted-foreground dark:border-white/10 dark:bg-white/[0.035]">
                <div className="mb-1 font-medium text-foreground/80">
                  Reasoning history
                </div>
                {historyReasoning}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}


