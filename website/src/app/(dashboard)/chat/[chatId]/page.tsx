"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { UIMessage } from "ai";
import { ChatContainer } from "@/components/chat/chat-container";
import { ChatRouteLoader } from "@/components/chat/chat-route-loader";
import { useAuth } from "@/components/auth-provider";
import { getIdToken } from "@/lib/firebase/auth";
import {
  clearPendingChatRouteHandoff,
  getPendingChatRouteHandoff,
  mergeChatRouteMessages,
  normalizeLoadedParts,
} from "@/lib/chat-route-handoff";
import { createClientLogger } from "@/lib/client-diagnostics";

interface ChatPageProps {
  params: Promise<{ chatId: string }>;
}

interface ChatData {
  id: string;
  project_id?: string;
  title?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  parts?: UIMessage["parts"] | null;
  metadata?: UIMessage["metadata"] | null;
  created_at: string;
}

interface InitialMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  parts: UIMessage["parts"];
  metadata?: UIMessage["metadata"];
}

type ChatResponse = {
  chat: ChatData | null;
  messages: Message[];
};

const log = createClientLogger("ChatPage");

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getChatData(value: unknown): ChatData | null {
  if (!isRecord(value) || typeof value.id !== "string") {
    return null;
  }

  return {
    id: value.id,
    ...(typeof value.project_id === "string" ? { project_id: value.project_id } : {}),
    ...(typeof value.title === "string" ? { title: value.title } : {}),
  };
}

function getMessage(value: unknown): Message | null {
  if (!isRecord(value) || typeof value.id !== "string") {
    return null;
  }

  if (value.role !== "user" && value.role !== "assistant") {
    return null;
  }

  return {
    id: value.id,
    role: value.role,
    content: typeof value.content === "string" ? value.content : "",
    parts: Array.isArray(value.parts) ? value.parts as UIMessage["parts"] : null,
    metadata: isRecord(value.metadata) ? value.metadata as UIMessage["metadata"] : null,
    created_at: typeof value.created_at === "string" ? value.created_at : "",
  };
}

async function readChatResponse(response: Response): Promise<ChatResponse> {
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!isRecord(payload)) {
    return { chat: null, messages: [] };
  }

  return {
    chat: getChatData(payload.chat),
    messages: Array.isArray(payload.messages)
      ? payload.messages.map(getMessage).filter((message): message is Message => Boolean(message))
      : [],
  };
}

export default function ChatPage({ params }: ChatPageProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [chatId, setChatId] = useState<string>("");
  const [chat, setChat] = useState<ChatData | null>(null);
  const [initialMessages, setInitialMessages] = useState<InitialMessage[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  useEffect(() => {
    params.then(({ chatId }) => {
      setChatId(chatId);
      // Try to load handoff messages immediately to avoid empty state
      const handoff = getPendingChatRouteHandoff(chatId);
      if (handoff && handoff.length > 0) {
        setInitialMessages(handoff);
      }
    });
  }, [params]);

  useEffect(() => {
    async function loadChatData() {
      if (!user || !chatId) return;

      try {
        const token = await getIdToken();
        if (!token) {
          throw new Error("Missing auth token");
        }
        const response = await fetch(`/api/dashboard/chats/${encodeURIComponent(chatId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          if (response.status === 404 || response.status === 403) {
            router.replace(`/chat/new?fresh=${Date.now()}`);
            return;
          }
          throw new Error("Failed to fetch chat");
        }

        const data = await readChatResponse(response);
        if (!data.chat) {
          throw new Error("Chat response did not include a valid chat");
        }

        setChat(data.chat);

        const persistedMessages: InitialMessage[] = data.messages
          .flatMap((m: Message) => {
            const normalized =
              m.parts && m.parts.length > 0
                ? normalizeLoadedParts(m.parts)
                : [];
            const fallbackText = (m.content || "").trim();
            const parts =
              normalized.length > 0
                ? normalized
                : fallbackText
                  ? [{ type: "text" as const, text: fallbackText }]
                  : [];

            if (parts.length === 0) {
              return [];
            }

            return [{
              id: m.id,
              role: m.role,
              content: m.content || "",
              parts,
              metadata: m.metadata ?? undefined,
            }];
          });

        const handoffMessages = getPendingChatRouteHandoff(
          chatId,
          data.chat.project_id ?? null
        );
        
        const mergedMessages = mergeChatRouteMessages(
          persistedMessages,
          handoffMessages
        );

        setInitialMessages(mergedMessages);
        setIsDataLoaded(true);
        clearPendingChatRouteHandoff(chatId, data.chat.project_id ?? null);
      } catch (error) {
        log.error("Error loading chat:", error);
        router.replace(`/chat/new?fresh=${Date.now()}`);
      }
    }

    if (user && chatId) {
      loadChatData();
    }
  }, [user, chatId, router]);

  if (authLoading) {
    return (
      <ChatRouteLoader />
    );
  }

  if (!user) {
    return null;
  }

  // Ensure we only show the chat container when we have messages (from handoff)
  // or when we've confirmed the full data load from Firestore is complete.
  // This prevents the "Suggestions" screen from showing up for existing chats on refresh.
  if (chatId && (initialMessages.length > 0 || isDataLoaded)) {
    return (
      <ChatContainer
        key={chatId}
        chatId={chatId}
        projectId={chat?.project_id}
        initialMessages={initialMessages}
      />
    );
  }

  // If no handoff messages yet and data is still loading, show a subtle loader
  return (
    <ChatRouteLoader
      title="Loading conversation"
      detail="Restoring messages and any handoff context for this thread."
    />
  );
}
