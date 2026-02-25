import { createClient, getUser } from "@/lib/supabase/server";
import { ChatContainer } from "@/components/chat/chat-container";
import { redirect } from "next/navigation";

interface NewProjectChatPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function NewProjectChatPage({
  params,
}: NewProjectChatPageProps) {
  const { projectId } = await params;

  const { data: { user } } = await getUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  // Verify project belongs to user
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) redirect("/projects");

  return <ChatContainer projectId={projectId} />;
}
