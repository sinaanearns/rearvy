import { createClient, getUser } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { ChatContainer } from "@/components/chat/chat-container";

interface ProjectChatPageProps {
  params: Promise<{ projectId: string; chatId: string }>;
}

export default async function ProjectChatPage({
  params,
}: ProjectChatPageProps) {
  const { projectId, chatId } = await params;

  const { data: { user } } = await getUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  const { data: chat } = await supabase
    .from("chats")
    .select("id, project_id, title")
    .eq("id", chatId)
    .eq("user_id", user.id)
    .eq("project_id", projectId)
    .single();

  if (!chat) notFound();

  const { data: messages } = await supabase
    .from("messages")
    .select("id, role, content, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  const initialMessages = (messages || [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      parts: [{ type: "text" as const, text: m.content || "" }],
    }));

  return (
    <ChatContainer
      chatId={chat.id}
      projectId={chat.project_id}
      initialMessages={initialMessages}
    />
  );
}
