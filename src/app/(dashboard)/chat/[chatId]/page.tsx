import { createClient, getUser } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { ChatContainer } from "@/components/chat/chat-container";

const SKIP_AUTH = process.env.SKIP_AUTH === "true";

interface ChatPageProps {
  params: Promise<{ chatId: string }>;
}

export default async function ChatPage({ params }: ChatPageProps) {
  const { chatId } = await params;

  const { data: { user } } = await getUser();

  if (!user) redirect("/login");

  // Development mode: use mock data to avoid database queries
  if (SKIP_AUTH) {
    return (
      <ChatContainer
        chatId={chatId}
        projectId={null}
        initialMessages={[]}
      />
    );
  }

  const supabase = await createClient();

  // Verify chat belongs to user
  const { data: chat } = await supabase
    .from("chats")
    .select("id, project_id, title")
    .eq("id", chatId)
    .eq("user_id", user.id)
    .single();

  if (!chat) notFound();

  // Load existing messages
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
