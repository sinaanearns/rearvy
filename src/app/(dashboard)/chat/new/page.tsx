import { ChatContainer } from "@/components/chat/chat-container";
import { getUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function NewChatPage() {
  const { data: { user } } = await getUser();

  if (!user) redirect("/login");

  return <ChatContainer />;
}
