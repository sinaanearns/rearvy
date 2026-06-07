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

interface ProjectChatPageProps {
  params: Promise<{ projectId: string; chatId: string }>;
}

interface ChatData {
  id: string;
  project_id: string;
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

type ProjectChatResponse = {
  chat: ChatData | null;
  messages: Message[];
};

const log = createClientLogger("ProjectChatPage");

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getChatData(value: unknown): ChatData | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.project_id !== "string") {
    return null;
  }

  return {
    id: value.id,
    project_id: value.project_id,
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

async function readProjectChatResponse(response: Response): Promise<ProjectChatResponse> {
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

export default function ProjectChatPage({
  params,
}: ProjectChatPageProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [projectId, setProjectId] = useState<string>("");
  const [chatId, setChatId] = useState<string>("");
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
        const response = await fetch(`/api/dashboard/chats/${encodeURIComponent(chatId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          if (response.status === 404 || response.status === 403) {
            router.replace(`/projects/${projectId}`);
            return;
          }
          throw new Error("Failed to fetch chat");
        }

        const data = await readProjectChatResponse(response);
        if (!data.chat) {
          throw new Error("Chat response did not include a valid project chat");
        }
        
        // Verify chat belongs to this project
        if (data.chat.project_id !== projectId) {
          router.push(`/projects/${encodeURIComponent(projectId)}`);
          return;
        }

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

        const handoffMessages = getPendingChatRouteHandoff(chatId, projectId);
        const mergedMessages = mergeChatRouteMessages(
          persistedMessages,
          handoffMessages
        );

        setInitialMessages(mergedMessages);
        setIsDataLoaded(true);
        clearPendingChatRouteHandoff(chatId, projectId);
      } catch (error) {
        log.error("Error loading chat:", error);
        router.replace(`/projects/${encodeURIComponent(projectId)}`);
      }
    }

    if (user && chatId && projectId) {
      loadChatData();
    }
  }, [user, chatId, projectId, router]);

  if (authLoading) {
    return (
      <ChatRouteLoader contextLabel="Project chat" variant="project" />
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
        initialMessages={initialMessages}
      />
    );
  }

  // Fallback loader while data is being fetched and no handoff is available
  return (
    <ChatRouteLoader
      title="Loading workspace conversation"
      detail="Restoring project messages, handoff context, and client workspace state."
      contextLabel="Project chat"
      variant="project"
    />
  );
}
