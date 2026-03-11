"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
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
  aiModel?: "free" | "paid";
}

type ChatMessage = UIMessage<{ chatId?: string }>;

export function ChatContainer({
  chatId,
  projectId,
  initialMessages = [],
  aiModel = "paid",
}: ChatContainerProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [activeChatId, setActiveChatId] = useState(chatId);
  const [token, setToken] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    setActiveChatId(chatId);
  }, [chatId]);

  // Get Firebase auth token from the authenticated user
  useEffect(() => {
    const getToken = async () => {
      try {
        if (user) {
          const idToken = await user.getIdToken();
          setToken(idToken);
        }
      } catch (error) {
        console.error("Failed to get auth token:", error);
      }
    };

    getToken();
  }, [user]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { chatId: activeChatId, projectId, aiModel },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }),
    [activeChatId, projectId, aiModel, token]
  );

  const activateChatId = useCallback(
    (nextChatId: string | null) => {
      if (!nextChatId || nextChatId === activeChatId) {
        return;
      }

      setActiveChatId(nextChatId);
      if (projectId) {
        router.replace(`/projects/${projectId}/chat/${nextChatId}`);
        return;
      }

      router.replace(`/chat/${nextChatId}`);
    },
    [activeChatId, projectId, router]
  );

  const { messages, sendMessage, stop, status } = useChat<ChatMessage>({
    transport,
    messages:
      initialMessages.length > 0
        ? (initialMessages as ChatMessage[])
        : undefined,
    onFinish: ({ message }) => {
      const metadata = message.metadata as { chatId?: unknown } | undefined;
      const nextChatId =
        typeof metadata?.chatId === "string" ? metadata.chatId : null;
      activateChatId(nextChatId);
    },
  });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (status === "submitted" || status === "streaming") {
      return;
    }

    const latestAssistantWithChatId = [...messages]
      .reverse()
      .find((message) => {
        if (message.role !== "assistant") {
          return false;
        }
        const metadata = message.metadata as { chatId?: unknown } | undefined;
        return typeof metadata?.chatId === "string";
      });

    const metadata = latestAssistantWithChatId?.metadata as
      | { chatId?: unknown }
      | undefined;
    const nextChatId =
      typeof metadata?.chatId === "string" ? metadata.chatId : null;
    activateChatId(nextChatId);
  }, [messages, status, activateChatId]);

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
      <div className="border-t bg-background px-4 py-4">
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
