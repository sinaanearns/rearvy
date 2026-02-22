import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function NewChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Create a new chat
  const { data: chat } = await supabase
    .from("chats")
    .insert({
      user_id: user.id,
      title: null,
    })
    .select("id")
    .single();

  if (!chat) {
    redirect("/chat");
  }

  redirect(`/chat/${chat.id}`);
}
