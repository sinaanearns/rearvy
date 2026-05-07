"use client";

import type { UIMessage } from "ai";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type TraceStatus = "running" | "complete" | "error";

type TraceEntry = {
  key: string;
  label: string;
  detail: string | null;
  status: TraceStatus;
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

    const existing = entries.get(key);
    if (!existing) {
      entries.set(key, { key, label, detail, status });
      continue;
    }

    existing.label = label;
    existing.status = status === "error" ? "error" : existing.status;
    existing.detail = detail ?? existing.detail;
  }

  return [...entries.values()];
}

export function AssistantTracePanel({
  parts,
  isLoading = false,
}: {
  parts: UIMessage["parts"];
  isLoading?: boolean;
}) {
  const entries = buildTraceEntries(parts);
  const shouldShowFallback = isLoading && entries.length === 0;

  if (entries.length === 0 && !shouldShowFallback) {
    return null;
  }

  return (
    <div className="w-full rounded-2xl border border-border/50 bg-gradient-to-br from-background/80 to-background/60 p-4 shadow-sm backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles className="h-4 w-4 text-sky-500" />
          <span>AI trace</span>
        </div>
        <div className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
          {isLoading ? "Live" : "Complete"}
        </div>
      </div>

      <div className="mt-3 space-y-2">
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
              "flex items-start gap-3 rounded-xl border px-3 py-2",
              entry.status === "error"
                ? "border-rose-500/30 bg-rose-500/5"
                : "border-border/40 bg-background/40"
            )}
          >
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
              <div className="flex min-w-0 items-center gap-2 text-sm text-foreground">
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
              {entry.detail ? (
                <div className="mt-0.5 break-words text-xs leading-5 text-muted-foreground">
                  {entry.detail}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}