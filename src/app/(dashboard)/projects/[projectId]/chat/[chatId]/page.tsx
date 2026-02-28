"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChatContainer } from "@/components/chat/chat-container";
import { useAuth } from "@/components/auth-provider";
import { Loader2 } from "lucide-react";

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
  created_at: string;
}

interface InitialMessage {
  id: string;
  role: "user" | "assistant";
  parts: Array<{ type: "text"; text: string }>;
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then(({ projectId, chatId }) => {
      setProjectId(projectId);
      setChatId(chatId);
    });
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
            router.push(`/projects/${projectId}`);
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

        const messages: InitialMessage[] = (data.messages || [])
          .filter((m: Message) => m.role === "user" || m.role === "assistant")
          .map((m: Message) => ({
            id: m.id,
            role: m.role,
            parts: [{ type: "text" as const, text: m.content || "" }],
          }));

        setInitialMessages(messages);
      } catch (error) {
        console.error("Error loading chat:", error);
      } finally {
        setLoading(false);
      }
    }

    if (user && chatId) {
      loadChatData();
    }
  }, [user, chatId, projectId, router]);

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
      chatId={chat.id}
      projectId={chat.project_id}
      initialMessages={initialMessages}
    />
  );
}
