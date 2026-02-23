import { createClient, getUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function NewChatPage() {
  const { data: { user } } = await getUser();

  if (!user) redirect("/login");

  const supabase = await createClient();

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
