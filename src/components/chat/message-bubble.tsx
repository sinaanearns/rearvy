"use client";

import type { UIMessage } from "ai";
import { cn } from "@/lib/utils";
import { Sparkles, User } from "lucide-react";
import { CardRouter } from "../data-cards/card-router";

interface MessageBubbleProps {
  message: UIMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 max-w-3xl mx-auto",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
          <Sparkles className="h-4 w-4 text-primary-foreground" />
        </div>
      )}

      {/* Content */}
      <div
        className={cn(
          "flex flex-col gap-2 max-w-[85%]",
          isUser ? "items-end" : "items-start"
        )}
      >
        {message.parts?.map((part, index) => {
          if (part.type === "text" && part.text) {
            return (
              <div
                key={index}
                className={cn(
                  "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  isUser
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                <div className="whitespace-pre-wrap">{part.text}</div>
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
              <CardRouter
                key={toolPart.toolCallId}
                toolName={toolName}
                state={toolPart.state}
                input={toolPart.input}
                output={toolPart.output}
              />
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
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
          <User className="h-4 w-4 text-secondary-foreground" />
        </div>
      )}
    </div>
  );
}
