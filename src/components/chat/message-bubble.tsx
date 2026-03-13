"use client";

import type { UIMessage } from "ai";
import { cn } from "@/lib/utils";
import { Sparkles, UserRound } from "lucide-react";
import { CardRouter } from "../data-cards/card-router";
import { ChatMarkdown } from "./chat-markdown";

interface MessageBubbleProps {
  message: UIMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-4xl gap-4 px-2 sm:px-4",
        isUser ? "justify-end pl-14 sm:pl-20" : "justify-start"
      )}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-card/80 shadow-sm">
          <Sparkles className="h-4 w-4 text-foreground" />
        </div>
      )}

      {/* Content */}
      <div
        className={cn(
          "flex min-w-0 flex-col gap-4",
          isUser ? "max-w-[min(78%,42rem)] items-end" : "max-w-[46rem] flex-1 items-start"
        )}
      >
        {message.parts?.map((part, index) => {
          if (part.type === "text" && part.text) {
            return (
              <div
                key={index}
                className={cn(
                  "w-full",
                  isUser
                    ? "rounded-[1.75rem] border border-border/70 bg-muted/70 px-5 py-3.5 text-[15px] leading-7 text-foreground shadow-sm"
                    : "text-foreground"
                )}
              >
                {isUser ? (
                  <div className="whitespace-pre-wrap break-words">{part.text}</div>
                ) : (
                  <ChatMarkdown content={part.text} />
                )}
              </div>
            );
          }

          // In AI SDK v6, tool parts have type 'tool-{toolName}' or 'dynamic-tool'
          if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
            const toolPart = part as {
              type: string;
              toolCallId: string;
              toolName?: string;
              state: string;
              input?: unknown;
              output?: unknown;
            };
            const toolName =
              toolPart.toolName || part.type.replace("tool-", "");
            return (
              <div key={toolPart.toolCallId} className="w-full">
                <CardRouter
                  toolName={toolName}
                  state={toolPart.state}
                  input={toolPart.input}
                  output={toolPart.output}
                />
              </div>
            );
          }

          if (part.type === "step-start") {
            return null; // Hide step separators
          }

          return null;
        })}
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
