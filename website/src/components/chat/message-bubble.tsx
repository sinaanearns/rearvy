"use client";

import type { UIMessage } from "ai";
import { sanitizeAssistantText } from "@/lib/ai/sanitize";
import { cn } from "@/lib/utils";
import { UserRound, Copy, Check, Lightbulb } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CardRouter } from "../data-cards/card-router";
import { AssistantTracePanel } from "./assistant-trace-panel";
import { ChatMarkdown } from "./chat-markdown";
import { WebSourcesStrip, type WebSourceItem } from "./web-sources-strip";
import { getBrowserConnectionCardDisplay } from "@/lib/chat/browser-connection-rendering";
import {
  getRenderableMessageFileKind,
  normalizeRenderableMessageAssetSrc,
} from "@/lib/chat/renderable-message-asset";
import { useState } from "react";
import { toast } from "sonner";

interface MessageBubbleProps {
  message: UIMessage;
  isLoading?: boolean;
  chatId?: string;
  browserCardMode?: "full" | "details";
  onToolOutput?: (params: {
    tool: string;
    toolCallId: string;
    output: unknown;
  }) => void | PromiseLike<void>;
  onToolApprovalResponse?: (params: {
    id: string;
    approved: boolean;
    reason?: string;
  }) => void | PromiseLike<void>;
}

const HIDDEN_TOOL_NAMES = new Set([
  "saveMemory",
  "runBrowserTask",
  "controlBrowserSession",
  "stopBrowserSession",
]);

const RICH_TOOL_CARD_NAMES = new Set([
  "getRevenue",
  "getRevenueBreakdown",
  "getOrders",
  "getOrderDetails",
  "getTopProducts",
  "getProductDetails",
  "getInventoryStatus",
  "comparePerformance",
  "getCustomerMetrics",
  "getInstagramAccountStats",
  "getTopInstagramPosts",
  "getInstagramPostPerformance",
  "getInstagramComments",
  "getProductReviews",
  "getReviewSummary",
  "prepareGmailMessage",
  "generateMap",
  "generateMedia",
  "generateDocument",
  "tradingOpinion",
  "getTradingOpinion",
  "getBestTradeOpportunity",
  "planWorkflow",
  "executeWorkflow",
]);

function isTextPart(part: UIMessage["parts"][number]): part is UIMessage["parts"][number] & {
  type: "text";
  text: string;
} {
  return part.type === "text" && typeof part.text === "string";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function isToolPart(part: UIMessage["parts"][number]): part is UIMessage["parts"][number] & {
  type: string;
  toolCallId: string;
  toolName?: string;
  state: string;
  input?: unknown;
  output?: unknown;
  result?: unknown;
} {
  return part.type.startsWith("tool-") || part.type === "dynamic-tool";
}

function getToolPartPayload(part: {
  output?: unknown;
  result?: unknown;
}) {
  if (part.output !== undefined && part.output !== null) {
    return part.output;
  }

  if (part.result !== undefined && part.result !== null) {
    return part.result;
  }

  return null;
}

function resolveToolName(part: {
  type: string;
  toolName?: string;
}) {
  return part.toolName || part.type.replace("tool-", "");
}

function hasAssistantToolErrors(metadata: UIMessage["metadata"]) {
  const record = asRecord(metadata);
  if (!record) {
    return false;
  }

  const toolErrors = record.toolErrors;
  return Array.isArray(toolErrors) && toolErrors.length > 0;
}

function isWebToolName(toolName: string) {
  return toolName === "searchWeb" || toolName === "fetchWebPage";
}

function hasRichToolCard(toolName: string) {
  return RICH_TOOL_CARD_NAMES.has(toolName);
}

function shouldRenderToolPart(
  part: UIMessage["parts"][number] & {
    type: string;
    toolCallId: string;
    toolName?: string;
    state: string;
    input?: unknown;
    output?: unknown;
    result?: unknown;
  }
) {
  const toolName = resolveToolName(part);
  const payload = getToolPartPayload(part);

  if (isWebToolName(toolName) || HIDDEN_TOOL_NAMES.has(toolName)) {
    return false;
  }

  if (
    toolName === "askUser" ||
    toolName === "requestBrowserConnection" ||
    part.state === "approval-requested" ||
    part.state === "approval-responded"
  ) {
    return true;
  }

  if (part.state === "running" || part.state === "partial" || part.state === "error") {
    return hasRichToolCard(toolName);
  }

  return payload !== null && hasRichToolCard(toolName);
}

function getSourceLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function extractWebSources(parts: UIMessage["parts"] | undefined): {
  query: string | null;
  sources: WebSourceItem[];
} {
  const sourceMap = new Map<string, WebSourceItem>();
  let query: string | null = null;

  for (const part of parts ?? []) {
    if (!isToolPart(part)) {
      continue;
    }

    const toolName = resolveToolName(part);
    if (!isWebToolName(toolName)) {
      continue;
    }

    const payload = getToolPartPayload(part);
    const output = asRecord(payload);

    if (!output) {
      continue;
    }

    if (!query && typeof output.query === "string") {
      query = output.query;
    }

    if (toolName === "searchWeb" && Array.isArray(output.results)) {
      for (const item of output.results) {
        const result = asRecord(item);
        if (!result) {
          continue;
        }

        const url = typeof result.url === "string" ? result.url : null;
        if (!url || sourceMap.has(url)) {
          continue;
        }

        sourceMap.set(url, {
          title:
            typeof result.title === "string" && result.title.trim()
              ? result.title
              : url,
          url,
          source:
            typeof result.source === "string" && result.source.trim()
              ? result.source
              : getSourceLabel(url),
          snippet:
            typeof result.snippet === "string" && result.snippet.trim()
              ? result.snippet
              : undefined,
        });
      }
    }

    if (toolName === "fetchWebPage") {
      const url = typeof output.url === "string" ? output.url : null;
      if (!url || sourceMap.has(url)) {
        continue;
      }

      sourceMap.set(url, {
        title:
          typeof output.title === "string" && output.title.trim()
            ? output.title
            : url,
        url,
        source: getSourceLabel(url),
        snippet:
          typeof output.message === "string" && output.message.trim()
            ? output.message
            : undefined,
      });
    }
  }

  return {
    query,
    sources: [...sourceMap.values()],
  };
}

function deduplicateTexts(texts: string[]): string[] {
  if (texts.length <= 1) return texts;

  const result: string[] = [texts[0]];
  for (let i = 1; i < texts.length; i++) {
    const current = texts[i];
    const prev = result[result.length - 1];

    if (prev.includes(current)) {
      continue;
    }

    if (current.includes(prev)) {
      result[result.length - 1] = current;
      continue;
    }

    let overlapLen = 0;
    const maxOverlap = Math.min(prev.length, current.length);
    for (let len = maxOverlap; len >= 10; len--) {
      if (prev.endsWith(current.substring(0, len))) {
        overlapLen = len;
        break;
      }
    }

    if (overlapLen > 0) {
      result[result.length - 1] = prev + current.substring(overlapLen);
    } else {
      result.push(current);
    }
  }
  return result;
}

function CopyMessageButton({
  copied,
  onCopy,
  className,
  tooltipSide = "top",
}: {
  copied: boolean;
  onCopy: () => void | Promise<void>;
  className?: string;
  tooltipSide?: "top" | "right" | "bottom" | "left";
}) {
  const label = copied ? "Copied" : "Copy message";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          onClick={onCopy}
          className={cn(
            "h-9 w-9 rounded-[8px] border border-border/60 bg-card/85 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-card hover:text-foreground dark:border-white/10 dark:bg-white/[0.045] dark:hover:bg-white/[0.09]",
            className
          )}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide} sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function MessageBubble({
  message,
  isLoading = false,
  chatId,
  browserCardMode = "full",
  onToolOutput,
  onToolApprovalResponse,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [isCopied, setIsCopied] = useState(false);
  const lastWebToolIndex = isUser
    ? -1
    : (message.parts ?? []).reduce((lastIndex, part, index) => {
        if (!isToolPart(part)) {
          return lastIndex;
        }

        return isWebToolName(resolveToolName(part)) ? index : lastIndex;
      }, -1);
  const hasPostWebVisibleText = !isUser
    ? (message.parts ?? []).some(
        (part, index) =>
          index > lastWebToolIndex &&
          isTextPart(part) &&
          Boolean(sanitizeAssistantText(part.text))
      )
    : false;
  const hidePreWebText = lastWebToolIndex >= 0 && hasPostWebVisibleText;
  const visibleAssistantTextParts = isUser
    ? []
    : deduplicateTexts(
        (message.parts ?? [])
          .flatMap((part, index) => {
            if (!isTextPart(part)) {
              return [];
            }

            if (hidePreWebText && index <= lastWebToolIndex) {
              return [];
            }

            const sanitizedText = sanitizeAssistantText(part.text);
            return sanitizedText ? [sanitizedText] : [];
          })
      );
  const webSources = isUser ? { query: null, sources: [] } : extractWebSources(message.parts);
  const hasAssistantErrors = !isUser && hasAssistantToolErrors(message.metadata);
  const hasRenderableToolPart = isUser
    ? false
    : (message.parts ?? []).some((part) => {
        if (!isToolPart(part)) {
          return false;
        }
        return shouldRenderToolPart(part);
      });
  const hasRenderableAssistantContent =
    visibleAssistantTextParts.length > 0 ||
    webSources.sources.length > 0 ||
    hasRenderableToolPart ||
    hasAssistantErrors;
  const showTracePanel = !isUser;

  if (!isUser && !isLoading && !hasRenderableAssistantContent) {
    return null;
  }

  const handleCopy = async () => {
    try {
      const textToCopy = isUser
        ? message.parts
            ?.filter(isTextPart)
            .map((part) => part.text)
            .join("\n\n")
        : visibleAssistantTextParts.join("\n\n");

      if (!textToCopy) return;

      await navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <div
      className={cn(
        "flex w-full min-w-0 items-start gap-3 overflow-x-clip overflow-y-visible px-1 sm:gap-4 sm:px-0",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "flex min-w-0 flex-col gap-4",
          isUser
            ? "ml-auto max-w-[42rem] items-end"
            : "w-full max-w-[62rem] flex-1 items-start"
        )}
      >
        {showTracePanel || hasAssistantErrors ? (
          <AssistantTracePanel
            parts={message.parts ?? []}
            metadata={message.metadata}
            isLoading={isLoading}
          />
        ) : null}

        {message.parts?.map((part, index) => {
          if (part.type === "text" && part.text) {
            if (!isUser) return null;

            return (
              <div
                key={index}
                className="group flex max-w-full items-start justify-end gap-2"
              >
                <CopyMessageButton
                  copied={isCopied}
                  onCopy={handleCopy}
                  className="mt-0.5 shrink-0 opacity-70 group-hover:opacity-100"
                />
                <div className="w-fit max-w-full rounded-[8px] border border-border/70 bg-muted/70 px-4 py-3 text-[15px] leading-6 text-foreground shadow-sm dark:border-white/10 dark:bg-white/[0.075] dark:text-white dark:shadow-[0_14px_42px_rgba(0,0,0,0.28)]">
                  <div className="whitespace-pre-wrap break-words">{part.text}</div>
                </div>
              </div>
            );
          }

          const partRecord = asRecord(part);

          if (partRecord?.type === "image") {
            const imgSrc = normalizeRenderableMessageAssetSrc(
              partRecord.image || partRecord.url || partRecord.data,
              "image"
            );
            if (!imgSrc) return null;

            return (
              <div key={index} className="relative max-w-sm overflow-hidden rounded-[8px] border bg-muted shadow-sm">
                <Image
                  src={imgSrc}
                  alt="Attachment"
                  className="h-auto w-full object-contain"
                  width={800}
                  height={600}
                  unoptimized
                />
              </div>
            );
          }

          if (part.type === "file") {
            const mediaType = partRecord?.contentType || partRecord?.mediaType;
            const mediaKind = getRenderableMessageFileKind(mediaType);
            const fileSrc = mediaKind
              ? normalizeRenderableMessageAssetSrc(
                  partRecord?.data || partRecord?.url,
                  mediaKind
                )
              : null;

            if (mediaKind === "image" && fileSrc) {
              return (
                <div key={index} className="relative max-w-sm overflow-hidden rounded-[8px] border bg-muted shadow-sm">
                  <Image
                    src={fileSrc}
                    alt={
                      typeof partRecord?.filename === "string"
                        ? partRecord.filename
                        : "Uploaded image"
                    }
                    className="h-auto w-full object-contain"
                    width={800}
                    height={600}
                    unoptimized
                  />
                </div>
              );
            }

            if (mediaKind === "video" && fileSrc) {
              return (
                <div key={index} className="relative max-w-sm overflow-hidden rounded-[8px] border bg-black shadow-sm">
                  <video
                    src={fileSrc}
                    controls
                    className="h-auto w-full"
                  />
                </div>
              );
            }
            return (
              <div key={index} className="flex items-center gap-2 rounded-[8px] border bg-muted/50 p-3 text-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                  <Check className="h-4 w-4" />
                </div>
                <span className="truncate max-w-[200px]">
                  {(typeof partRecord?.name === "string" && partRecord.name) ||
                    (typeof partRecord?.filename === "string" && partRecord.filename) ||
                    "Attachment"}
                </span>
              </div>
            );
          }

          if (isToolPart(part)) {
            const toolPart = part;
            const browserConnectionDisplay = getBrowserConnectionCardDisplay(
              message.parts ?? [],
              index
            );
            if (browserConnectionDisplay === "hidden") {
              return null;
            }

            if (!shouldRenderToolPart(toolPart)) {
              return null;
            }

            const toolName = resolveToolName(toolPart);
            const isTradingOpinion = toolName === "tradingOpinion" || toolName === "getTradingOpinion";
            const tradingOpinionHeader = isTradingOpinion ? (
              <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                <Lightbulb className="h-3.5 w-3.5" />
                <span>Trading Opinion</span>
              </div>
            ) : null;

            return (
              <div key={toolPart.toolCallId} className="w-full">
                {tradingOpinionHeader}
                <CardRouter
                  toolName={toolName}
                  state={toolPart.state}
                  toolCallId={toolPart.toolCallId}
                  input={toolPart.input}
                  output={getToolPartPayload(toolPart)}
                  approval={asRecord(toolPart)?.approval}
                  chatId={chatId}
                  browserCardMode={browserCardMode}
                  browserConnectionDisplay={browserConnectionDisplay}
                  onToolOutput={onToolOutput}
                  onToolApprovalResponse={onToolApprovalResponse}
                />
              </div>
            );
          }

          if (part.type === "step-start") {
            return null;
          }

          return null;
        })}

        {!isUser && visibleAssistantTextParts.map((text, index) => (
          <div
            key={`assistant-text-${index}`}
            className="group relative w-full min-w-0 max-w-[48rem] text-foreground sm:pl-1"
          >
            <div className="py-1 pr-11 sm:pr-12">
              <ChatMarkdown content={text} />
            </div>
            <CopyMessageButton
              copied={isCopied}
              onCopy={handleCopy}
              className="absolute right-0 top-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
              tooltipSide="left"
            />
          </div>
        ))}
        
        {!isUser && visibleAssistantTextParts.length === 0 && isLoading && !hasPostWebVisibleText && null}

        {!isUser && webSources.sources.length > 0 ? (
          <WebSourcesStrip
            query={webSources.query}
            sources={webSources.sources}
          />
        ) : null}
      </div>

      {isUser && (
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-border/70 bg-card/85 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
          <UserRound className="h-4 w-4 text-foreground/85" />
        </div>
      )}
    </div>
  );
}
