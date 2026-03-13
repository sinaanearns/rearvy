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
import { DEFAULT_PLAN, type SubscriptionPlan } from "@/lib/plans";
import {
  getAvailableChatModels,
  getDefaultChatModelTier,
  type ChatModelTier,
} from "@/lib/ai/models";
import {
  savePendingChatRouteHandoff,
  type ChatRouteMessage,
} from "@/lib/chat-route-handoff";

interface ChatContainerProps {
  chatId?: string;
  projectId?: string | null;
  initialMessages?: Array<{
    id: string;
    role: "user" | "assistant";
    parts: UIMessage["parts"];
  }>;
  aiModel?: ChatModelTier;
}

type ChatMessage = UIMessage<{ chatId?: string }>;

export function ChatContainer({
  chatId,
  projectId,
  initialMessages = [],
  aiModel = "free",
}: ChatContainerProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [activeChatId, setActiveChatId] = useState(chatId);
  const [token, setToken] = useState<string | null>(null);
  const [plan, setPlan] = useState<SubscriptionPlan>(DEFAULT_PLAN);
  const [selectedModel, setSelectedModel] = useState<ChatModelTier>(aiModel || "free");
  const { user } = useAuth();
  const messagesRef = useRef<ChatMessage[]>(initialMessages as ChatMessage[]);
  const availableModels = useMemo(() => getAvailableChatModels(plan), [plan]);
  const effectiveModel = useMemo(() => {
    return availableModels.some((model) => model.id === selectedModel)
      ? selectedModel
      : getDefaultChatModelTier(plan);
  }, [availableModels, plan, selectedModel]);

  useEffect(() => {
    setActiveChatId(chatId);
  }, [chatId]);

  useEffect(() => {
    let isActive = true;

    const loadSessionContext = async () => {
      try {
        if (!user) {
          if (!isActive) {
            return;
          }
          setToken(null);
          setPlan(DEFAULT_PLAN);
          return;
        }

        const idToken = await user.getIdToken();
        if (!isActive) {
          return;
        }

        setToken(idToken);

        const response = await fetch("/api/dashboard/profile", {
          headers: { Authorization: `Bearer ${idToken}` },
        });

        if (!response.ok) {
          throw new Error("Failed to load profile");
        }

        const data = (await response.json()) as {
          profile?: { plan?: SubscriptionPlan | null };
        };

        if (!isActive) {
          return;
        }

        setPlan(data.profile?.plan === "pro" ? "pro" : DEFAULT_PLAN);
      } catch (error) {
        console.error("Failed to load chat plan context:", error);
        if (isActive) {
          setPlan(DEFAULT_PLAN);
        }
      }
    };

    loadSessionContext();

    return () => {
      isActive = false;
    };
  }, [user]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { chatId: activeChatId, projectId, aiModel: effectiveModel },
        headers: async () => {
          if (user) {
            const freshToken = await user.getIdToken();
            return { Authorization: `Bearer ${freshToken}` };
          }
          return token
            ? { Authorization: `Bearer ${token}` }
            : ({} as Record<string, string>);
        },
      }),
    [activeChatId, projectId, effectiveModel, token, user]
  );

  const buildRouteHandoffMessages = useCallback(
    (finalAssistantMessage?: ChatMessage): ChatRouteMessage[] => {
      const snapshot = [...messagesRef.current];

      if (finalAssistantMessage) {
        const existingIndex = snapshot.findIndex(
          (message) => message.id === finalAssistantMessage.id
        );

        if (existingIndex >= 0) {
          snapshot[existingIndex] = finalAssistantMessage;
        } else {
          snapshot.push(finalAssistantMessage);
        }
      }

      return snapshot
        .filter(
          (message): message is ChatMessage =>
            (message.role === "user" || message.role === "assistant") &&
            Array.isArray(message.parts)
        )
        .map((message) => ({
          id: message.id,
          role: message.role,
          parts: message.parts,
        }));
    },
    []
  );

  const activateChatId = useCallback(
    (nextChatId: string | null, handoffMessages?: ChatRouteMessage[]) => {
      if (!nextChatId || nextChatId === activeChatId) {
        return;
      }

      const messagesForRoute = handoffMessages ?? buildRouteHandoffMessages();
      if (messagesForRoute.length > 0) {
        savePendingChatRouteHandoff({
          chatId: nextChatId,
          projectId,
          messages: messagesForRoute,
        });
      }

      setActiveChatId(nextChatId);
      if (projectId) {
        router.replace(`/projects/${projectId}/chat/${nextChatId}`);
        return;
      }

      router.replace(`/chat/${nextChatId}`);
    },
    [activeChatId, buildRouteHandoffMessages, projectId, router]
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
      activateChatId(nextChatId, buildRouteHandoffMessages(message));
    },
  });

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

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
    <div className="flex h-[calc(100vh-7rem)] min-h-0 flex-col">
      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scroll-smooth"
      >
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-3 pb-10 pt-8 sm:px-6 sm:pt-10">
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
      </div>

      {/* Input */}
      <div className="border-t border-border/70 bg-background/85 px-3 pb-5 pt-4 backdrop-blur-xl sm:px-6">
        <ChatInput
          input={input}
          setInput={setInput}
          onSend={handleSend}
          isLoading={isLoading}
          onStop={stop}
          aiModel={effectiveModel}
          availableModels={availableModels}
          currentPlan={plan}
          onModelChange={setSelectedModel}
        />
      </div>
    </div>
  );
}
