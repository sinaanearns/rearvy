"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { UIMessage } from "ai";
import { ChatContainer } from "@/components/chat/chat-container";
import { useAuth } from "@/components/auth-provider";
import { Loader2 } from "lucide-react";
import {
  clearPendingChatRouteHandoff,
  getPendingChatRouteHandoff,
  mergeChatRouteMessages,
  normalizeLoadedParts,
} from "@/lib/chat-route-handoff";

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
  created_at: string;
}

interface InitialMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  parts: UIMessage["parts"];
}

export default function ChatPage({ params }: ChatPageProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [chatId, setChatId] = useState<string>("");
  const [chat, setChat] = useState<ChatData | null>(null);
  const [initialMessages, setInitialMessages] = useState<InitialMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then(({ chatId }) => setChatId(chatId));
  }, [params]);

  useEffect(() => {
    async function loadChatData() {
      if (!user || !chatId) return;

      try {
        const token = await user.getIdToken();
        const response = await fetch(`/api/dashboard/chats/${chatId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          if (response.status === 404) {
            router.push("/chats");
            return;
          }
          throw new Error("Failed to fetch chat");
        }

        const data = await response.json();
        setChat(data.chat);

        const persistedMessages: InitialMessage[] = (data.messages || [])
          .filter((m: Message) => m.role === "user" || m.role === "assistant")
          .map((m: Message) => {
            const normalized =
              m.parts && m.parts.length > 0
                ? normalizeLoadedParts(m.parts)
                : [{ type: "text" as const, text: m.content || "" }];

            console.log("[ChatPage] loaded message", {
              id: m.id,
              role: m.role,
              hasContent: Boolean(m.content),
              contentLength: m.content?.length ?? 0,
              rawPartsCount: m.parts?.length ?? 0,
              rawPartTypes: m.parts?.map((p) => (p as Record<string, unknown>).type) ?? [],
              normalizedPartsCount: normalized.length,
              normalizedPartTypes: normalized.map((p) => p.type),
            });

            return {
              id: m.id,
              role: m.role,
              content: m.content || "",
              parts: normalized,
            };
          });

        const handoffMessages = getPendingChatRouteHandoff(
          chatId,
          data.chat.project_id ?? null
        );
        const messages = mergeChatRouteMessages(
          persistedMessages,
          handoffMessages
        );

        setInitialMessages(messages);
        clearPendingChatRouteHandoff(chatId, data.chat.project_id ?? null);
      } catch (error) {
        console.error("Error loading chat:", error);
      } finally {
        setLoading(false);
      }
    }

    if (user && chatId) {
      loadChatData();
    }
  }, [user, chatId, router]);

  if (authLoading || loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  if (!chat) {
    return null;
  }

  return (
    <ChatContainer
      key={chat.id}
      chatId={chat.id}
      projectId={chat.project_id}
      initialMessages={initialMessages}
    />
  );
}
