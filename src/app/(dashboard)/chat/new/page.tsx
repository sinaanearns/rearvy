import { createClient, getUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const SKIP_AUTH = process.env.SKIP_AUTH === "true";

export default async function NewChatPage() {
  const { data: { user } } = await getUser();

  if (!user) redirect("/login");

  // Development mode: redirect to a mock chat ID
  if (SKIP_AUTH) {
    redirect("/chat/dev-chat-id");
  }

  const supabase = await createClient();

  // Create a new chat
  const { data: chat, error } = await supabase
    .from("chats")
    .insert({
      user_id: user.id,
      title: null,
    })
    .select("id")
    .single();

  if (error || !chat) {
    console.error("Failed to create new chat:", error);
    // Redirect to insights or somewhere safe that doesn't loop back here
    redirect("/insights?error=chat_creation_failed");
  }

  redirect(`/chat/${chat.id}`);
}
