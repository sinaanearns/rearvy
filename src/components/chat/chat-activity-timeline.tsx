"use client";

import type { UIMessage } from "ai";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Circle,
  Cpu,
  Database,
  Globe2,
  HardDrive,
  Loader2,
  Wrench,
} from "lucide-react";
import {
  type ChatActivityData,
  type ChatActivityKind,
  type ChatActivityStatus,
  isChatActivityPart,
} from "@/lib/ai/chat-activity";
import { cn } from "@/lib/utils";

type MessagePart = UIMessage["parts"][number];

type ActivityItem = ChatActivityData & {
  key: string;
};

const toolLabels: Record<string, string> = {
  comparePerformance: "Compare performance",
  controlBrowserSession: "Control browser",
  delegateToSpecialistAgent: "Delegate to specialist",
  fetchWebPage: "Open source page",
  generateMap: "Generate map",
  getBestTradeOpportunity: "Find best trade opportunity",
  getCollectionsBreakdown: "Read collection breakdown",
  getCollectionsOverview: "Read collections overview",
  getCurrentDate: "Check current date",
  getCustomerMetrics: "Analyze customers",
  getGmailInboxSummary: "Read Gmail inbox",
  getGmailSettings: "Check Gmail settings",
  getGoogleAnalyticsOverview: "Read Google Analytics",
  getGoogleAnalyticsTopPages: "Read GA top pages",
  getGoogleAnalyticsTrafficSources: "Read GA traffic sources",
  getIntegrationStatus: "Check integrations",
  getInventoryStatus: "Check inventory",
  getOrderDetails: "Read order details",
  getOrders: "Read orders",
  getProductDetails: "Read product details",
  getProductReviews: "Read product reviews",
  getRecentGmailMessages: "Read recent Gmail",
  getRecentInsights: "Read insights",
  getRevenue: "Read revenue",
  getRevenueBreakdown: "Break down revenue",
  getReviewSummary: "Summarize reviews",
  getTopPages: "Read top pages",
  getTopProducts: "Read top products",
  getTrafficSources: "Read traffic sources",
  getTradingOpinion: "Get trading opinion",
  getVerifiedTraderSignals: "Check trader signals",
  getWebsiteOverview: "Read website overview",
  prepareGmailMessage: "Prepare Gmail draft",
  runBrowserTask: "Run browser task",
  runWhispernetAnalysis: "Run Whispernet analysis",
  saveMemory: "Save memory",
  searchGmailMessages: "Search Gmail",
  searchMemories: "Search memory",
  searchWeb: "Search web",
  selectOperationsCapability: "Select operations capability",
  spawnAgentTeam: "Spawn agent team",
  stopBrowserSession: "Stop browser session",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isToolPart(part: MessagePart): part is MessagePart & {
  type: string;
  toolCallId: string;
  toolName?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  result?: unknown;
  errorText?: string;
} {
  return (
    typeof part.type === "string" &&
    (part.type === "dynamic-tool" || part.type.startsWith("tool-"))
  );
}

function resolveToolName(part: { type: string; toolName?: string }) {
  return part.toolName || part.type.replace("tool-", "");
}

function humanizeIdentifier(value: string) {
  const words = value
    .replace(/^tool-/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();

  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Tool";
}

function getToolLabel(toolName: string) {
  return toolLabels[toolName] ?? humanizeIdentifier(toolName);
}

function compactText(value: string, maxLength = 130) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
}

function getDomain(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function summarizeToolInput(toolName: string, input: unknown) {
  if (!isRecord(input)) {
    return null;
  }

  const query = typeof input.query === "string" ? input.query : null;
  const url = typeof input.url === "string" ? input.url : null;
  const symbol = typeof input.symbol === "string" ? input.symbol : null;
  const timeframe = typeof input.timeframe === "string" ? input.timeframe : null;
  const task = typeof input.task === "string" ? input.task : null;
  const request = typeof input.request === "string" ? input.request : null;
  const feature = typeof input.feature === "string" ? input.feature : null;
  const recipient = typeof input.to === "string" ? input.to : null;
  const subject = typeof input.subject === "string" ? input.subject : null;

  if (toolName === "searchWeb" && query) {
    return `Query: ${compactText(query)}`;
  }

  if (toolName === "fetchWebPage" && url) {
    return `Source: ${getDomain(url) ?? compactText(url)}`;
  }

  if (toolName === "getTradingOpinion" && symbol) {
    return `Symbol: ${symbol}${timeframe ? `, ${timeframe}` : ""}`;
  }

  if ((toolName === "runBrowserTask" || toolName === "controlBrowserSession") && task) {
    return `Task: ${compactText(task)}`;
  }

  if (toolName === "selectOperationsCapability") {
    return [feature ? `Feature: ${feature}` : null, request ? compactText(request) : null]
      .filter(Boolean)
      .join(" - ");
  }

  if (toolName === "prepareGmailMessage") {
    return [
      recipient ? `To: ${recipient}` : null,
      subject ? `Subject: ${compactText(subject, 72)}` : null,
    ]
      .filter(Boolean)
      .join(" - ");
  }

  const keys = Object.keys(input).filter((key) => input[key] !== undefined);
  if (keys.length === 0) {
    return null;
  }

  return `Input: ${keys.slice(0, 4).join(", ")}${keys.length > 4 ? "..." : ""}`;
}

function summarizeToolOutput(output: unknown) {
  if (!isRecord(output)) {
    return null;
  }

  const message =
    typeof output.message === "string"
      ? output.message
      : typeof output.error === "string"
        ? output.error
        : typeof output.errorCode === "string"
          ? output.errorCode
          : null;

  if (message) {
    return compactText(message);
  }

  if (Array.isArray(output.results)) {
    return `${output.results.length} result${output.results.length === 1 ? "" : "s"} returned`;
  }

  if (Array.isArray(output.orders)) {
    return `${output.orders.length} order${output.orders.length === 1 ? "" : "s"} returned`;
  }

  if (Array.isArray(output.products)) {
    return `${output.products.length} product${output.products.length === 1 ? "" : "s"} returned`;
  }

  if (typeof output.url === "string") {
    return `Opened ${getDomain(output.url) ?? compactText(output.url)}`;
  }

  if (typeof output.action === "string" && typeof output.symbol === "string") {
    return `${output.symbol}: ${output.action}`;
  }

  return "Completed";
}

function getToolStatus(state: string | undefined): ChatActivityStatus {
  if (state === "output-error" || state === "output-denied") {
    return "error";
  }

  if (
    state === "output-available" ||
    state === "approval-responded"
  ) {
    return "complete";
  }

  if (state === "input-streaming" || state === "input-available") {
    return "running";
  }

  return "pending";
}

function toToolActivity(part: MessagePart & {
  type: string;
  toolCallId: string;
  toolName?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  result?: unknown;
  errorText?: string;
}): ActivityItem {
  const toolName = resolveToolName(part);
  const status = getToolStatus(part.state);
  const output = part.output ?? part.result;
  const errorDetail =
    typeof part.errorText === "string" && part.errorText.trim()
      ? compactText(part.errorText)
      : null;
  const outputDetail =
    status === "complete" || status === "error"
      ? summarizeToolOutput(output)
      : null;
  const inputDetail = summarizeToolInput(toolName, part.input);
  const detail =
    errorDetail ??
    outputDetail ??
    inputDetail ??
    (status === "running" ? "Waiting for tool result" : undefined);

  return {
    id: `tool-${part.toolCallId}`,
    key: `tool-${part.toolCallId}`,
    title: getToolLabel(toolName),
    status,
    detail: detail || undefined,
    kind: toolName === "searchWeb" || toolName === "fetchWebPage" ? "web" : "tool",
  };
}

function collectActivityItems(parts: UIMessage["parts"] | undefined): ActivityItem[] {
  const itemsByKey = new Map<string, ActivityItem>();
  const orderedKeys: string[] = [];

  const upsertItem = (item: ActivityItem) => {
    const key = item.key || item.id;
    if (!itemsByKey.has(key)) {
      orderedKeys.push(key);
    }

    itemsByKey.set(key, {
      ...itemsByKey.get(key),
      ...item,
      key,
    });
  };

  for (const part of parts ?? []) {
    if (isChatActivityPart(part)) {
      upsertItem({
        ...part.data,
        key: part.data.id,
      });
      continue;
    }

    if (isToolPart(part)) {
      const record = part as MessagePart & {
        type: string;
        toolCallId?: string;
        toolName?: string;
        state?: string;
        input?: unknown;
        output?: unknown;
        result?: unknown;
        errorText?: string;
      };

      if (typeof record.toolCallId !== "string") {
        continue;
      }

      upsertItem(
        toToolActivity({
          ...record,
          toolCallId: record.toolCallId,
        })
      );
    }
  }

  return orderedKeys
    .map((key) => itemsByKey.get(key))
    .filter((item): item is ActivityItem => Boolean(item));
}

function getStatusIcon(status: ChatActivityStatus) {
  if (status === "running") {
    return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
  }

  if (status === "complete") {
    return <CheckCircle2 className="h-3.5 w-3.5" />;
  }

  if (status === "error") {
    return <AlertTriangle className="h-3.5 w-3.5" />;
  }

  return <Circle className="h-3 w-3" />;
}

function getKindIcon(kind: ChatActivityKind | undefined) {
  switch (kind) {
    case "context":
      return <Database className="h-3.5 w-3.5" />;
    case "model":
      return <Cpu className="h-3.5 w-3.5" />;
    case "tool":
      return <Wrench className="h-3.5 w-3.5" />;
    case "web":
      return <Globe2 className="h-3.5 w-3.5" />;
    case "memory":
    case "storage":
      return <HardDrive className="h-3.5 w-3.5" />;
    default:
      return <BrainCircuit className="h-3.5 w-3.5" />;
  }
}

function getStatusClass(status: ChatActivityStatus) {
  if (status === "running") return "text-sky-500";
  if (status === "complete") return "text-emerald-500";
  if (status === "error") return "text-red-500";
  return "text-muted-foreground";
}

export function hasActivityTimelineContent(
  parts: UIMessage["parts"] | undefined,
  isLoading: boolean
) {
  return isLoading || collectActivityItems(parts).length > 0;
}

export function ChatActivityTimeline({
  parts,
  isLoading = false,
}: {
  parts: UIMessage["parts"] | undefined;
  isLoading?: boolean;
}) {
  const items = collectActivityItems(parts);
  const fallbackItem =
    items.length > 0
      ? null
      : isLoading
        ? {
            id: "pending-analysis",
            key: "pending-analysis",
            title: "Analyzing request",
            detail: "Preparing context",
            status: "running" as const,
            kind: "analysis" as const,
          }
        : null;
  const currentItem =
    [...items].reverse().find((item) => item.status === "running") ??
    [...items].reverse().find((item) => item.status === "error") ??
    items[items.length - 1] ??
    fallbackItem;
  const completedCount = items.filter((item) => item.status === "complete").length;

  if (!currentItem) {
    return null;
  }

  return (
    <div
      className="w-full max-w-full rounded-xl border border-border/60 bg-card/45 px-3 py-2.5 text-sm shadow-sm"
      role="status"
      aria-live={isLoading ? "polite" : "off"}
    >
      <div className="grid grid-cols-[1rem_1fr] gap-2">
        <span
          className={cn(
            "mt-0.5 flex h-4 w-4 items-center justify-center",
            getStatusClass(currentItem.status)
          )}
          aria-hidden="true"
        >
          {getStatusIcon(currentItem.status)}
        </span>
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
            <span className="shrink-0 text-muted-foreground" aria-hidden="true">
              {getKindIcon(currentItem.kind)}
            </span>
            <span className="shrink-0 text-xs font-medium text-muted-foreground">
              Working
            </span>
            <p className="min-w-0 break-words text-sm font-medium leading-5 text-foreground">
              {currentItem.title}
            </p>
          </div>
          {currentItem.detail ? (
            <p className="break-words text-xs leading-5 text-muted-foreground">
              {currentItem.detail}
            </p>
          ) : null}
          {completedCount > 0 && isLoading ? (
            <p className="text-xs leading-5 text-muted-foreground/80">
              {completedCount} step{completedCount === 1 ? "" : "s"} done
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
