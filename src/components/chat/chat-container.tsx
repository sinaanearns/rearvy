"use client";

import { useChat } from "@ai-sdk/react";
import { type UIMessage } from "ai";
import { useState, useEffect, useRef, useMemo, useCallback, type WheelEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { getIdToken } from "@/lib/firebase/auth";
import { MessageBubble } from "./message-bubble";
import { ChatInput } from "./chat-input";
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
import { MEMORY_UPDATED_EVENT } from "@/lib/memory-events";
import {
  getChatSessionKey,
  getOrCreateChatClientSession,
  hydrateChatClientSessionMessages,
  promoteChatClientSession,
  updateChatClientSessionRequest,
  type PersistentChatMessage,
} from "@/lib/chat/client-chat-sessions";

interface ChatContainerProps {
  chatId?: string;
  projectId?: string | null;
  initialMessages?: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    parts: UIMessage["parts"];
  }>;
  aiModel?: ChatModelTier;
}

type ChatMessage = UIMessage<{ chatId?: string }>;
type PendingOutgoingMessage = {
  text: string;
  files: File[];
};

const AUTO_SCROLL_THRESHOLD_PX = 24;

function isTextPart(part: UIMessage["parts"][number]): part is Extract<
  UIMessage["parts"][number],
  { type: "text" }
> {
  return part.type === "text" && typeof part.text === "string";
}

function getMessageContent(message: ChatMessage): string {
  return (message.parts ?? [])
    .filter(isTextPart)
    .map((part) => part.text)
    .join("\n");
}

function getSavedMemoryIds(messages: ChatMessage[]) {
  const savedIds: string[] = [];

  for (const message of messages) {
    for (const part of message.parts ?? []) {
      if (!part || typeof part !== "object") {
        continue;
      }

      const record = part as Record<string, unknown>;
      if (record.toolName !== "saveMemory") {
        continue;
      }

      const output =
        record.output && typeof record.output === "object"
          ? (record.output as Record<string, unknown>)
          : null;

      if (!output || output.saved !== true) {
        continue;
      }

      if (typeof output.id === "string") {
        savedIds.push(output.id);
      } else if (typeof record.toolCallId === "string") {
        savedIds.push(record.toolCallId);
      }
    }
  }

  return savedIds;
}

function getLatestResolvedChatId(messages: ChatMessage[]): string | null {
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

  return typeof metadata?.chatId === "string" ? metadata.chatId : null;
}

function createFileList(files: File[]): FileList {
  const dataTransfer = new DataTransfer();

  for (const file of files) {
    dataTransfer.items.add(file);
  }

  return dataTransfer.files;
}

export function ChatContainer({
  chatId,
  projectId,
  initialMessages = [],
  aiModel = "free",
}: ChatContainerProps) {
  const pathname = usePathname();
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const isProgrammaticScrollRef = useRef(false);
  const pendingRouteChatIdRef = useRef<string | null>(null);
  const [input, setInput] = useState("");
  const [activeChatId, setActiveChatId] = useState(chatId);
  const [queuedMessages, setQueuedMessages] = useState<PendingOutgoingMessage[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [plan, setPlan] = useState<SubscriptionPlan>(DEFAULT_PLAN);
  const [selectedModel, setSelectedModel] = useState<ChatModelTier>(aiModel || "free");
  const { user } = useAuth();
  const messagesRef = useRef<ChatMessage[]>(initialMessages as ChatMessage[]);
  const seenMemorySaveIdsRef = useRef<Set<string>>(new Set());
  const queuedMessagesRef = useRef<PendingOutgoingMessage[]>([]);
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
    queuedMessagesRef.current = queuedMessages;
  }, [queuedMessages]);

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

        const idToken = await getIdToken();
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

        await response.json() as {
          profile?: { plan?: SubscriptionPlan | null };
        };

        if (!isActive) {
          return;
        }

        setPlan(DEFAULT_PLAN);
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

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (user) {
      const freshToken = await getIdToken();
      if (freshToken) {
        return { Authorization: `Bearer ${freshToken}` };
      }
    }

    return token ? { Authorization: `Bearer ${token}` } : ({} as Record<string, string>);
  }, [token, user]);

  const sessionKey = useMemo(
    () => getChatSessionKey({ chatId, projectId }),
    [chatId, projectId]
  );

  const chatSession = useMemo(
    () =>
      getOrCreateChatClientSession({
        key: sessionKey,
        chatId: chatId ?? null,
        projectId: projectId ?? null,
        aiModel: effectiveModel,
        getHeaders: getAuthHeaders,
        initialMessages: initialMessages as PersistentChatMessage[],
      }),
    // The session is keyed by route identity. Live auth/model/chatId request state
    // is updated in effects below so the same in-flight chat can survive route changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chatId, sessionKey]
  );

  useEffect(() => {
    hydrateChatClientSessionMessages(
      sessionKey,
      initialMessages as PersistentChatMessage[]
    );
  }, [initialMessages, sessionKey]);

  useEffect(() => {
    updateChatClientSessionRequest(sessionKey, {
      chatId: activeChatId ?? chatId ?? null,
      projectId: projectId ?? null,
      aiModel: effectiveModel,
      getHeaders: getAuthHeaders,
    });
  }, [activeChatId, chatId, effectiveModel, getAuthHeaders, projectId, sessionKey]);

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
          (
            message
          ): message is ChatMessage & { role: "user" | "assistant" } =>
            (message.role === "user" || message.role === "assistant") &&
            Array.isArray(message.parts)
        )
        .map((message) => ({
          id: message.id,
          role: message.role,
          content: getMessageContent(message),
          parts: message.parts as UIMessage["parts"],
        }));
    },
    []
  );

  const updateAutoScrollPreference = useCallback(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    if (isProgrammaticScrollRef.current) {
      return;
    }

    const distanceFromBottom =
      container.scrollHeight - container.clientHeight - container.scrollTop;
    shouldAutoScrollRef.current = distanceFromBottom <= AUTO_SCROLL_THRESHOLD_PX;
  }, []);

  const scrollToBottom = useCallback(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    isProgrammaticScrollRef.current = true;
    container.scrollTop = container.scrollHeight;

    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        isProgrammaticScrollRef.current = false;
      });
    } else {
      isProgrammaticScrollRef.current = false;
    }
  }, []);

  const handleWheelCapture = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      if (event.deltaY < 0) {
        shouldAutoScrollRef.current = false;
        return;
      }

      updateAutoScrollPreference();
    },
    [updateAutoScrollPreference]
  );

  const navigateToChat = useCallback(
    (nextChatId: string, handoffMessages?: ChatRouteMessage[]) => {
      const targetPath = projectId
        ? `/projects/${projectId}/chat/${nextChatId}`
        : `/chat/${nextChatId}`;

      if (pathname === targetPath) {
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

      router.replace(targetPath);
    },
    [buildRouteHandoffMessages, pathname, projectId, router]
  );

  const activateChatId = useCallback(
    (nextChatId: string | null, handoffMessages?: ChatRouteMessage[]) => {
      if (!nextChatId) {
        return;
      }

      if (nextChatId !== activeChatId) {
        setActiveChatId(nextChatId);
      }

      if (queuedMessagesRef.current.length > 0) {
        pendingRouteChatIdRef.current = nextChatId;
        return;
      }

      pendingRouteChatIdRef.current = null;
      navigateToChat(nextChatId, handoffMessages);
    },
    [activeChatId, navigateToChat]
  );

  const { messages, sendMessage, stop, status } = useChat<ChatMessage>({
    chat: chatSession.chat,
  });

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    return () => {
      if (!activeChatId) {
        return;
      }

      if (status !== "submitted" && status !== "streaming") {
        return;
      }

      const handoffMessages = buildRouteHandoffMessages();
      if (handoffMessages.length === 0) {
        return;
      }

      savePendingChatRouteHandoff({
        chatId: activeChatId,
        projectId,
        messages: handoffMessages,
      });
    };
  }, [activeChatId, buildRouteHandoffMessages, projectId, status]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let shouldNotify = false;
    for (const id of getSavedMemoryIds(messages)) {
      if (seenMemorySaveIdsRef.current.has(id)) {
        continue;
      }

      seenMemorySaveIdsRef.current.add(id);
      shouldNotify = true;
    }

    if (shouldNotify) {
      window.dispatchEvent(new CustomEvent(MEMORY_UPDATED_EVENT));
    }
  }, [messages]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let shouldNotify = false;
    for (const message of messages) {
      const metadata = message.metadata as
        | { autoSavedMemoryId?: unknown }
        | undefined;

      if (typeof metadata?.autoSavedMemoryId !== "string") {
        continue;
      }

      if (seenMemorySaveIdsRef.current.has(metadata.autoSavedMemoryId)) {
        continue;
      }

      seenMemorySaveIdsRef.current.add(metadata.autoSavedMemoryId);
      shouldNotify = true;
    }

    if (shouldNotify) {
      window.dispatchEvent(new CustomEvent(MEMORY_UPDATED_EVENT));
    }
  }, [messages]);

  const isLoading = status === "submitted" || status === "streaming";

  const dispatchMessage = useCallback(
    (message: PendingOutgoingMessage) => {
      const trimmedText = message.text.trim();
      const hasFiles = message.files.length > 0;
      const files = hasFiles ? createFileList(message.files) : null;

      shouldAutoScrollRef.current = true;

      if (files && trimmedText) {
        sendMessage({
          text: trimmedText,
          files,
        });
        return;
      }

      if (files) {
        sendMessage({
          files,
        });
        return;
      }

      sendMessage({
        text: trimmedText,
      });
    },
    [sendMessage]
  );

  useEffect(() => {
    if (status === "submitted" || status === "streaming") {
      return;
    }

    const nextChatId = getLatestResolvedChatId(messages);
    if (nextChatId && !chatId) {
      const targetSessionKey = getChatSessionKey({
        chatId: nextChatId,
        projectId: projectId ?? null,
      });

      promoteChatClientSession({
        fromKey: sessionKey,
        toKey: targetSessionKey,
        chatId: nextChatId,
        projectId: projectId ?? null,
        aiModel: effectiveModel,
        getHeaders: getAuthHeaders,
      });
    }

    activateChatId(nextChatId);
  }, [
    activateChatId,
    chatId,
    effectiveModel,
    getAuthHeaders,
    messages,
    projectId,
    sessionKey,
    status,
  ]);

  useEffect(() => {
    if (isLoading || queuedMessages.length === 0) {
      return;
    }

    const [nextMessage] = queuedMessages;
    if (!nextMessage) {
      return;
    }

    setQueuedMessages((currentQueue) => currentQueue.slice(1));
    dispatchMessage(nextMessage);
  }, [dispatchMessage, isLoading, queuedMessages]);

  useEffect(() => {
    if (isLoading || queuedMessages.length > 0) {
      return;
    }

    const pendingRouteChatId = pendingRouteChatIdRef.current;
    if (!pendingRouteChatId) {
      return;
    }

    pendingRouteChatIdRef.current = null;
    navigateToChat(pendingRouteChatId);
  }, [isLoading, navigateToChat, queuedMessages.length]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    if (messages.length === 0) {
      container.scrollTop = 0;
      shouldAutoScrollRef.current = true;
      return;
    }

    if (shouldAutoScrollRef.current) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  useEffect(() => {
    shouldAutoScrollRef.current = true;
  }, [activeChatId]);

  const handleSend = (text: string, files?: File[]) => {
    const trimmedText = text.trim();
    const normalizedFiles = files?.length ? files : [];
    const hasFiles = normalizedFiles.length > 0;
    if (!trimmedText && !hasFiles) return;

    const nextMessage: PendingOutgoingMessage = {
      text: trimmedText,
      files: normalizedFiles,
    };

    if (isLoading) {
      setQueuedMessages((currentQueue) => [...currentQueue, nextMessage]);
      setInput("");
      return;
    }

    dispatchMessage(nextMessage);
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
        onWheelCapture={handleWheelCapture}
        onScroll={updateAutoScrollPreference}
        className="flex-1 overflow-y-auto"
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-3 pb-10 pt-8 sm:px-6 sm:pt-10">
          {messages.length === 0 ? (
            <ChatTemplates onSelect={handleTemplateClick} />
          ) : (
            messages.map((message, index) => (
              <MessageBubble 
                key={message.id} 
                message={message} 
                isLoading={isLoading && index === messages.length - 1}
              />
            ))
          )}

          {isLoading && messages.length > 0 && messages[messages.length - 1].role === "user" && (
            <MessageBubble 
              key="pending-assistant" 
              message={{ id: "pending", role: "assistant" } as ChatMessage} 
              isLoading={true} 
            />
          )}

          {/* Loading indicators removed per user request to speed up perception */}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border/70 bg-background/85 px-3 pb-5 pt-4 backdrop-blur-xl sm:px-6">
        <ChatInput
          input={input}
          setInput={setInput}
          onSend={handleSend}
          isLoading={isLoading}
          queuedMessageCount={queuedMessages.length}
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
