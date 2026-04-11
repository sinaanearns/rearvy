"use client";

import type { UIMessage } from "ai";
import { sanitizeAssistantText } from "@/lib/ai/sanitize";
import { cn } from "@/lib/utils";
import { Sparkles, UserRound, Copy, Check, Bot } from "lucide-react";
import { CardRouter } from "../data-cards/card-router";
import { ChatMarkdown } from "./chat-markdown";
import { WebSourcesStrip, type WebSourceItem } from "./web-sources-strip";
import { useState } from "react";
import { toast } from "sonner";

interface MessageBubbleProps {
  message: UIMessage;
  isLoading?: boolean;
  chatId?: string;
}

function isTextPart(part: UIMessage["parts"][number]): part is UIMessage["parts"][number] & {
  type: "text";
  text: string;
} {
  return part.type === "text" && typeof part.text === "string";
}

function isToolPart(part: UIMessage["parts"][number]): part is UIMessage["parts"][number] & {
  type: string;
  toolCallId: string;
  toolName?: string;
  state: string;
  input?: unknown;
  output?: unknown;
} {
  return part.type.startsWith("tool-") || part.type === "dynamic-tool";
}

function resolveToolName(part: {
  type: string;
  toolName?: string;
}) {
  return part.toolName || part.type.replace("tool-", "");
}

function isWebToolName(toolName: string) {
  return toolName === "searchWeb" || toolName === "fetchWebPage";
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

    const output =
      part.output && typeof part.output === "object"
        ? (part.output as Record<string, unknown>)
        : null;

    if (!output) {
      continue;
    }

    if (!query && typeof output.query === "string") {
      query = output.query;
    }

    if (toolName === "searchWeb" && Array.isArray(output.results)) {
      for (const item of output.results) {
        if (!item || typeof item !== "object") {
          continue;
        }

        const result = item as Record<string, unknown>;
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

/**
 * Deduplicate text parts that share overlapping content.
 * Some models emit the same text across multiple text parts
 * (e.g. before and after a raw tool call that gets stripped).
 */
function deduplicateTexts(texts: string[]): string[] {
  if (texts.length <= 1) return texts;

  const result: string[] = [texts[0]];
  for (let i = 1; i < texts.length; i++) {
    const current = texts[i];
    const prev = result[result.length - 1];

    // If the current text is entirely contained within the previous text, skip it
    if (prev.includes(current)) {
      continue;
    }

    // If the previous text is entirely contained within the current text, replace it
    if (current.includes(prev)) {
      result[result.length - 1] = current;
      continue;
    }

    // Check for overlapping suffix/prefix: the end of prev matches the start of current
    let overlapLen = 0;
    const maxOverlap = Math.min(prev.length, current.length);
    for (let len = maxOverlap; len >= 10; len--) {
      if (prev.endsWith(current.substring(0, len))) {
        overlapLen = len;
        break;
      }
    }

    if (overlapLen > 0) {
      // Merge: append only the non-overlapping tail of current
      result[result.length - 1] = prev + current.substring(overlapLen);
    } else {
      result.push(current);
    }
  }
  return result;
}

export function MessageBubble({ message, isLoading = false, chatId }: MessageBubbleProps) {
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
        "mx-auto flex w-full max-w-5xl gap-4 px-2 sm:px-4",
        isUser ? "justify-end pl-14 sm:pl-20" : "justify-start"
      )}
    >
      {/* Avatar */}
      {!isUser && (
        <div 
          className={cn(
            "mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border shadow-sm transition-colors duration-300",
            isLoading
              ? "border-blue-500/30 bg-blue-500/10"
              : "border-border/70 bg-card/80"
          )}
        >
          {isLoading ? (
            <Bot className="h-4 w-4 text-blue-500 animate-pulse" />
          ) : (
            <Sparkles className="h-4 w-4 text-foreground transition-all duration-300" />
          )}
        </div>
      )}

      {/* Content */}
      <div
        className={cn(
          "flex min-w-0 flex-col gap-4",
          isUser ? "max-w-[min(78%,48rem)] items-end" : "max-w-full flex-1 items-start"
        )}
      >
        {/* Render user text parts and tool parts from original parts */}
        {message.parts?.map((part, index) => {
          if (part.type === "text" && part.text) {
            // For assistant messages, text is rendered separately via visibleAssistantTextParts below
            if (!isUser) return null;

            return (
              <div
                key={index}
                className="group relative w-full rounded-[1.75rem] border border-border/70 bg-muted/70 px-5 py-3.5 text-[15px] leading-7 text-foreground shadow-sm"
              >
                <div className="whitespace-pre-wrap break-words">{part.text}</div>
              </div>
            );
          }

          if ((part as any).type === "image") {
            const imgSrc = (part as any).image || (part as any).url || (part as any).data;
            if (!imgSrc) return null;
            return (
              <div key={index} className="relative max-w-sm overflow-hidden rounded-2xl border bg-muted shadow-sm">
                <img
                  src={imgSrc instanceof URL ? imgSrc.toString() : imgSrc}
                  alt="Attachment"
                  className="h-auto w-full object-contain"
                />
              </div>
            );
          }

          if (part.type === "file") {
            const mediaType = (part as any).contentType || (part as any).mediaType;
            const isImage = typeof mediaType === "string" && mediaType.startsWith("image/");
            const isVideo = typeof mediaType === "string" && mediaType.startsWith("video/");
            const fileSrc = (part as any).data || (part as any).url;

            if (isImage && fileSrc) {
              return (
                <div key={index} className="relative max-w-sm overflow-hidden rounded-2xl border bg-muted shadow-sm">
                  <img
                    src={fileSrc instanceof URL ? fileSrc.toString() : fileSrc}
                    alt={(part as any).filename || "Uploaded image"}
                    className="h-auto w-full object-contain"
                  />
                </div>
              );
            }

            if (isVideo && fileSrc) {
                return (
                    <div key={index} className="relative max-w-sm overflow-hidden rounded-2xl border bg-black shadow-sm">
                        <video
                            src={fileSrc instanceof URL ? fileSrc.toString() : fileSrc}
                            controls
                            className="h-auto w-full"
                        />
                    </div>
                );
            }
            return (
              <div key={index} className="flex items-center gap-2 rounded-xl border bg-muted/50 p-3 text-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Check className="h-4 w-4" />
                </div>
                <span className="truncate max-w-[200px]">{(part as any).name || (part as any).filename || "Attachment"}</span>
              </div>
            );
          }

          if (isToolPart(part)) {
            const toolPart = part;
            const toolName = resolveToolName(toolPart);

            if (isWebToolName(toolName)) {
              return null;
            }

            // Add special header for trading opinions
            const isTradingOpinion = toolName === 'tradingOpinion' || toolName === 'getTradingOpinion';
            const tradingOpinionHeader = isTradingOpinion ? (
              <div className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <span>💡</span>
                <span>Trading Opinion</span>
              </div>
            ) : null;

            return (
              <div key={toolPart.toolCallId} className="w-full">
                {tradingOpinionHeader}
                <CardRouter
                  toolName={toolName}
                  state={toolPart.state}
                  output={toolPart.output}
                  chatId={chatId}
                />
              </div>
            );
          }

          if (part.type === "step-start") {
            return null; // Hide step separators
          }

          return null;
        })}

        {/* Render deduplicated assistant text */}
        {!isUser && visibleAssistantTextParts.map((text, index) => (
          <div key={`assistant-text-${index}`} className="group relative w-full text-foreground">
            <ChatMarkdown content={text} />
            <button
              onClick={handleCopy}
              className="absolute -right-10 top-0 p-2 rounded-xl border border-border/50 bg-card/50 text-muted-foreground hover:text-foreground hover:bg-card opacity-0 group-hover:opacity-100 transition-all shadow-sm backdrop-blur-sm"
              title="Copy message"
            >
              {isCopied ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        ))}
        
        {/* Render loading dots if no text is present yet but it is loading */}
        {!isUser && visibleAssistantTextParts.length === 0 && isLoading && !hasPostWebVisibleText && (
          <div className="flex items-center gap-1.5 rounded-2xl bg-muted/50 px-4 py-2 text-muted-foreground w-fit h-[42px] mt-2 mb-2">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500/60 animate-[bounce_1s_infinite_0ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500/60 animate-[bounce_1s_infinite_200ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500/60 animate-[bounce_1s_infinite_400ms]" />
          </div>
        )}

        {!isUser && webSources.sources.length > 0 ? (
          <WebSourcesStrip
            query={webSources.query}
            sources={webSources.sources}
          />
        ) : null}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-card/80 shadow-sm">
          <UserRound className="h-4 w-4 text-foreground" />
        </div>
      )}
    </div>
  );
}
