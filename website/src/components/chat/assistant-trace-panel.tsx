"use client";

import type { UIMessage } from "ai";
import { useState } from "react";
import { AlertTriangle, ArrowRight, ChevronDown, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type TraceStatus = "running" | "complete" | "error";

type TraceEntry = {
  key: string;
  label: string;
  detail: string | null;
  status: TraceStatus;
  toolName: string;
  input: unknown;
  output: unknown;
};

type TracePart = UIMessage["parts"][number] & {
  type: string;
  toolCallId?: string;
  toolName?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  args?: unknown;
  result?: unknown;
};

const TOOL_LABELS: Record<string, string> = {
  searchMemories: "Searching memory",
  saveMemory: "Saving memory",
  searchWeb: "Searching the web",
  fetchWebPage: "Opening source page",
  getCurrentDate: "Checking the date",
  getIntegrationStatus: "Checking integrations",
  getRecentInsights: "Loading recent insights",
  runBrowserTask: "Running browser task",
  controlBrowserSession: "Controlling browser session",
  stopBrowserSession: "Stopping browser session",
  getTradingOpinion: "Running trading analysis",
  getBestTradeOpportunity: "Finding trade setup",
  getVerifiedTraderSignals: "Reviewing trader signals",
  prepareGmailMessage: "Preparing Gmail draft",
  generateMap: "Generating map",
};

const CODE_FIELD_NAMES = [
  "code",
  "generatedCode",
  "script",
  "command",
  "source",
  "snippet",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function firstNonEmptyString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const normalized = value.trim();
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function formatExpandedValue(value: unknown, limit = 4000) {
  if (value == null) {
    return null;
  }

  let text: string;
  if (typeof value === "string") {
    text = value;
  } else if (typeof value === "number" || typeof value === "boolean") {
    text = String(value);
  } else {
    try {
      text = JSON.stringify(value, null, 2) ?? String(value);
    } catch {
      text = String(value);
    }
  }

  const normalized = text.trim();
  if (!normalized) {
    return null;
  }

  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit - 1)}…`;
}

function extractCodeLikeText(value: unknown, seen = new WeakSet<object>()): string | null {
  if (typeof value === "string") {
    return value.trim() ? value.trim() : null;
  }

  if (!isRecord(value)) {
    return null;
  }

  if (seen.has(value)) {
    return null;
  }

  seen.add(value);

  for (const field of CODE_FIELD_NAMES) {
    const candidate = value[field];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  for (const field of ["input", "args", "payload", "body", "data", "result", "output"]) {
    const nested = value[field];
    const nestedText = extractCodeLikeText(nested, seen);
    if (nestedText) {
      return nestedText;
    }
  }

  return null;
}

function truncateText(text: string, limit = 88) {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit - 1)}…`;
}

function formatLabel(toolName: string) {
  return (
    TOOL_LABELS[toolName] ||
    toolName
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[-_]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^./, (character) => character.toUpperCase())
  );
}

function resolveToolName(part: TracePart) {
  if (typeof part.toolName === "string" && part.toolName.trim()) {
    return part.toolName.trim();
  }

  if (part.type === "dynamic-tool") {
    return "dynamic tool";
  }

  return part.type.replace(/^tool-/, "").replace(/-available$/, "");
}

function getPayloadSummary(payload: unknown): string | null {
  if (payload == null) {
    return null;
  }

  if (typeof payload === "string") {
    return truncateText(payload);
  }

  if (typeof payload === "number" || typeof payload === "boolean") {
    return String(payload);
  }

  if (Array.isArray(payload)) {
    return `${payload.length} item${payload.length === 1 ? "" : "s"}`;
  }

  if (!isRecord(payload)) {
    return null;
  }

  const directValue = firstNonEmptyString(
    payload.query,
    payload.message,
    payload.summary,
    payload.reason,
    payload.title,
    payload.name,
    payload.url,
    payload.errorDetails,
    payload.error
  );

  if (directValue) {
    return truncateText(directValue);
  }

  if (typeof payload.saved === "boolean") {
    return payload.saved ? "Saved successfully" : "Not saved";
  }

  if (Array.isArray(payload.results)) {
    return `${payload.results.length} result${payload.results.length === 1 ? "" : "s"}`;
  }

  if (Array.isArray(payload.items)) {
    return `${payload.items.length} item${payload.items.length === 1 ? "" : "s"}`;
  }

  if (typeof payload.count === "number") {
    return `${payload.count} item${payload.count === 1 ? "" : "s"}`;
  }

  return null;
}

function inferStatus(part: TracePart): TraceStatus {
  const state = typeof part.state === "string" ? part.state : "";

  if (state.includes("error") || state.includes("denied")) {
    return "error";
  }

  if (
    state.includes("running") ||
    state.includes("partial") ||
    state.includes("input-available") ||
    part.type === "tool-call"
  ) {
    return "running";
  }

  return "complete";
}

function getTraceDetail(part: TracePart, status: TraceStatus) {
  const inputSummary = getPayloadSummary(part.input ?? part.args);
  const outputSummary = getPayloadSummary(part.output ?? part.result);

  if (status === "running") {
    return inputSummary ?? outputSummary;
  }

  if (status === "error") {
    return outputSummary ?? inputSummary ?? "Tool request failed";
  }

  return outputSummary ?? inputSummary;
}

function getToolErrors(metadata: UIMessage["metadata"]) {
  const record = isRecord(metadata) ? metadata : null;
  const errors = record?.toolErrors;

  if (!Array.isArray(errors)) {
    return [];
  }

  return errors
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const toolName = firstNonEmptyString(item.toolName) ?? "Unknown tool";
      const errorCode = firstNonEmptyString(item.errorCode) ?? "TOOL_ERROR";
      const message = firstNonEmptyString(item.message) ?? "Tool execution failed.";

      return { toolName, errorCode, message };
    })
    .filter((item): item is { toolName: string; errorCode: string; message: string } => item !== null);
}

function buildTraceEntries(parts: UIMessage["parts"]): TraceEntry[] {
  const entries = new Map<string, TraceEntry>();

  for (const [index, part] of parts.entries()) {
    if (!part || typeof part !== "object") {
      continue;
    }

    const tracePart = part as TracePart;
    if (typeof tracePart.type !== "string") {
      continue;
    }

    if (!tracePart.type.startsWith("tool-") && tracePart.type !== "dynamic-tool") {
      continue;
    }

    const key =
      typeof tracePart.toolCallId === "string" && tracePart.toolCallId
        ? tracePart.toolCallId
        : `${tracePart.type}-${index}`;
    const label = formatLabel(resolveToolName(tracePart));
    const status = inferStatus(tracePart);
    const detail = getTraceDetail(tracePart, status);
    const input = tracePart.input ?? tracePart.args ?? null;
    const output = tracePart.output ?? tracePart.result ?? null;

    const existing = entries.get(key);
    if (!existing) {
      entries.set(key, { key, label, detail, status, toolName: resolveToolName(tracePart), input, output });
      continue;
    }

    existing.label = label;
    existing.status = status === "error" ? "error" : existing.status;
    existing.detail = detail ?? existing.detail;
    existing.input = input ?? existing.input;
    existing.output = output ?? existing.output;
  }

  return [...entries.values()];
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
  const entries = buildTraceEntries(parts);
  const toolErrors = getToolErrors(metadata);
  const shouldShowFallback = isLoading && entries.length === 0;

  if (entries.length === 0 && !shouldShowFallback && toolErrors.length === 0) {
    return null;
  }

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
    <div className="w-full rounded-2xl border border-border/50 bg-gradient-to-br from-background/80 to-background/60 p-4 shadow-sm backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles className="h-4 w-4 text-sky-500" />
          <span>AI execution trace</span>
        </div>
        <div className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
          {isLoading ? "Live" : "Complete"}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {toolErrors.length > 0 ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-200">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <p className="font-medium">What went wrong</p>
                <div className="mt-1 space-y-1 text-xs leading-5 text-rose-200/90">
                  {toolErrors.map((error) => (
                    <div key={`${error.toolName}-${error.errorCode}-${error.message}`}>
                      <span className="font-semibold">{error.toolName}</span>
                      {": "}
                      <span>{error.message}</span>
                      <span className="ml-1 text-rose-200/70">({error.errorCode})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {shouldShowFallback ? (
          <div className="flex items-start gap-3 rounded-xl border border-border/40 bg-background/50 px-3 py-2">
            <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-sky-500" />
            <div>
              <div className="text-sm font-medium text-foreground">Thinking through the request</div>
              <div className="text-xs text-muted-foreground">
                Reading context and preparing the next action.
              </div>
            </div>
          </div>
        ) : null}

        {entries.map((entry) => (
          <div
            key={entry.key}
            className={cn(
              "rounded-xl border px-3 py-2",
              entry.status === "error"
                ? "border-rose-500/30 bg-rose-500/5"
                : "border-border/40 bg-background/40"
            )}
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                  entry.status === "running"
                    ? "bg-sky-500 ring-4 ring-sky-500/15"
                    : entry.status === "error"
                      ? "bg-rose-500 ring-4 ring-rose-500/15"
                      : "bg-emerald-500/80"
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center justify-between gap-2 text-sm text-foreground">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium">{entry.label}</span>
                    <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="truncate text-muted-foreground">
                      {entry.status === "running"
                        ? "working"
                        : entry.status === "error"
                          ? "failed"
                          : "done"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleEntry(entry.key)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border/60 bg-background/70 px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-background"
                  >
                    {expandedEntries.has(entry.key) ? (
                      <>
                        <ChevronDown className="h-3.5 w-3.5" />
                        Hide code
                      </>
                    ) : (
                      <>
                        <ChevronRight className="h-3.5 w-3.5" />
                        Show code
                      </>
                    )}
                  </button>
                </div>
                {entry.detail ? (
                  <div className="mt-0.5 break-words text-xs leading-5 text-muted-foreground">
                    {entry.detail}
                  </div>
                ) : null}

                {expandedEntries.has(entry.key) ? (
                  <div className="mt-3 space-y-2">
                    {extractCodeLikeText(entry.input) ? (
                      <div>
                        <div className="mb-1 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                          Executed code
                        </div>
                        <pre className="overflow-x-auto rounded-lg border border-border/50 bg-background/80 p-3 text-[11px] leading-5 text-foreground">
                          {extractCodeLikeText(entry.input)}
                        </pre>
                      </div>
                    ) : null}

                    <div>
                      <div className="mb-1 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                        Input
                      </div>
                      <pre className="overflow-x-auto rounded-lg border border-border/50 bg-background/80 p-3 text-[11px] leading-5 text-foreground">
                        {formatExpandedValue(entry.input) ?? "No input"}
                      </pre>
                    </div>

                    <div>
                      <div className="mb-1 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                        Output
                      </div>
                      <pre className={cn(
                        "overflow-x-auto rounded-lg border bg-background/80 p-3 text-[11px] leading-5 text-foreground",
                        entry.status === "error"
                          ? "border-rose-500/30"
                          : "border-border/50"
                      )}>
                        {formatExpandedValue(entry.output) ?? (entry.status === "error" ? "Tool failed before it returned output." : "No output")}
                      </pre>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}