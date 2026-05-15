"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { UIMessage } from "ai";
import { ChatContainer } from "@/components/chat/chat-container";
import { useAuth } from "@/components/auth-provider";
import { getIdToken } from "@/lib/firebase/auth";
import { Loader2 } from "lucide-react";
import {
  clearPendingChatRouteHandoff,
  getPendingChatRouteHandoff,
  mergeChatRouteMessages,
  normalizeLoadedParts,
} from "@/lib/chat-route-handoff";

interface DesktopChatPageProps {
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
  created_at: string;
}

interface InitialMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  parts: UIMessage["parts"];
}

export default function DesktopChatPage({ params }: DesktopChatPageProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [chatId, setChatId] = useState<string>("");
  const [chat, setChat] = useState<ChatData | null>(null);
  const [initialMessages, setInitialMessages] = useState<InitialMessage[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  useEffect(() => {
    params.then(({ chatId }) => {
      setChatId(chatId);
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

        const response = await fetch(`/api/dashboard/chats/${chatId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          if (response.status === 404 || response.status === 403) {
            router.replace(`/desktop?fresh=${Date.now()}`);
            return;
          }
          throw new Error("Failed to fetch chat");
        }

        const data = await response.json();
        setChat(data.chat);

        const persistedMessages: InitialMessage[] = (data.messages || [])
          .filter((message: Message) => message.role === "user" || message.role === "assistant")
          .flatMap((message: Message) => {
            const normalized = message.parts && message.parts.length > 0 ? normalizeLoadedParts(message.parts) : [];
            const fallbackText = (message.content || "").trim();
            const parts = normalized.length > 0
              ? normalized
              : fallbackText
                ? [{ type: "text" as const, text: fallbackText }]
                : [];

            if (parts.length === 0) {
              return [];
            }

            return [{
              id: message.id,
              role: message.role,
              content: message.content || "",
              parts,
            }];
          });

        const handoffMessages = getPendingChatRouteHandoff(chatId, data.chat.project_id ?? null);
        const mergedMessages = mergeChatRouteMessages(persistedMessages, handoffMessages);

        setInitialMessages(mergedMessages);
        setIsDataLoaded(true);
        clearPendingChatRouteHandoff(chatId, data.chat.project_id ?? null);
      } catch (error) {
        console.error("Error loading desktop chat:", error);
        router.replace(`/desktop?fresh=${Date.now()}`);
      }
    }

    if (user && chatId) {
      void loadChatData();
    }
  }, [chatId, router, user]);

  if (authLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (chatId && (initialMessages.length > 0 || isDataLoaded)) {
    return (
      <ChatContainer
        key={chatId}
        chatId={chatId}
        projectId={chat?.project_id}
        initialMessages={initialMessages}
        routeMode="desktop"
      />
    );
  }

  return (
    <div className="flex h-[400px] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
    </div>
  );
}