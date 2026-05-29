"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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

interface ProjectChatPageProps {
  params: Promise<{ projectId: string; chatId: string }>;
}

interface ChatData {
  id: string;
  project_id: string;
  title?: string;
  agent_id?: string | null;
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

export default function ProjectChatPage({
  params,
}: ProjectChatPageProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [projectId, setProjectId] = useState<string>("");
  const [chatId, setChatId] = useState<string>("");
  const [chat, setChat] = useState<ChatData | null>(null);
  const [initialMessages, setInitialMessages] = useState<InitialMessage[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  useEffect(() => {
    params.then(({ projectId, chatId }) => {
      setProjectId(projectId);
      setChatId(chatId);
      // Load handoff messages immediately to avoid empty state
      const handoff = getPendingChatRouteHandoff(chatId, projectId);
      if (handoff && handoff.length > 0) {
        setInitialMessages(handoff);
      }
    });
  }, [params]);

  useEffect(() => {
    async function loadChatData() {
      if (!user || !chatId || !projectId) return;

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
            router.replace(`/projects/${projectId}`);
            return;
          }
          throw new Error("Failed to fetch chat");
        }

        const data = await response.json();
        
        // Verify chat belongs to this project
        if (data.chat.project_id !== projectId) {
          router.push(`/projects/${projectId}`);
          return;
        }

        setChat(data.chat);

        const persistedMessages: InitialMessage[] = (data.messages || [])
          .filter((m: Message) => m.role === "user" || m.role === "assistant")
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

        const handoffMessages = getPendingChatRouteHandoff(chatId, projectId);
        const mergedMessages = mergeChatRouteMessages(
          persistedMessages,
          handoffMessages
        );

        setInitialMessages(mergedMessages);
        setIsDataLoaded(true);
        clearPendingChatRouteHandoff(chatId, projectId);
      } catch (error) {
        console.error("Error loading chat:", error);
        router.replace(`/projects/${projectId}`);
      }
    }

    if (user && chatId && projectId) {
      loadChatData();
    }
  }, [user, chatId, projectId, router]);

  if (authLoading) {
    return (
      <div className="flex min-h-0 w-full flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  // Show the chat container as soon as we have a chatId.
  // We use chatId as key to force remount only when navigating between chats.
  // Ensure we only show the chat container when we have messages (from handoff)
  // or when we've confirmed the full data load from Firestore is complete.
  if (chatId && (initialMessages.length > 0 || isDataLoaded)) {
    return (
      <ChatContainer
        key={chatId}
        chatId={chatId}
        projectId={projectId}
        initialAgentId={chat?.agent_id ?? null}
        initialMessages={initialMessages}
      />
    );
  }

  // Fallback loader while data is being fetched and no handoff is available
  return (
    <div className="flex min-h-0 w-full flex-1 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
