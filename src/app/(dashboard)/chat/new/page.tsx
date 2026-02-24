import { createClient, getUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function NewChatPage() {
  const { data: { user } } = await getUser();

  if (!user) redirect("/login");

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
