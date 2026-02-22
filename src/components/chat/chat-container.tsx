"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useEffect, useRef, useMemo } from "react";
import { MessageBubble } from "./message-bubble";
import { ChatInput } from "./chat-input";
import { ToolLoadingIndicator } from "./tool-loading-indicator";
import { ChatTemplates } from "./chat-templates";

interface ChatContainerProps {
  chatId?: string;
  projectId?: string | null;
  initialMessages?: Array<{
    id: string;
    role: "user" | "assistant";
    parts: Array<{ type: "text"; text: string }>;
  }>;
}

export function ChatContainer({
  chatId,
  projectId,
  initialMessages = [],
}: ChatContainerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { chatId, projectId },
      }),
    [chatId, projectId]
  );

  const { messages, sendMessage, stop, status } = useChat({
    transport,
    messages: initialMessages.length > 0 ? initialMessages : undefined,
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (text: string) => {
    if (!text.trim() || isLoading) return;
    sendMessage({ text: text.trim() });
    setInput("");
  };

  const handleTemplateClick = (prompt: string) => {
    handleSend(prompt);
  };

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-4"
      >
        {messages.length === 0 ? (
          <ChatTemplates onSelect={handleTemplateClick} />
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}

        {isLoading &&
          messages.length > 0 &&
          messages[messages.length - 1].role === "user" && (
            <ToolLoadingIndicator />
          )}
      </div>

      {/* Input */}
      <div className="border-t bg-background px-4 py-3">
        <ChatInput
          input={input}
          setInput={setInput}
          onSend={handleSend}
          isLoading={isLoading}
          onStop={stop}
        />
      </div>
    </div>
  );
}
