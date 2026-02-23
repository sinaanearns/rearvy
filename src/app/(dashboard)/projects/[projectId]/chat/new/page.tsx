import { createClient, getUser } from "@/lib/supabase/server";
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

  // Create a new chat within this project
  const { data: chat } = await supabase
    .from("chats")
    .insert({
      user_id: user.id,
      project_id: projectId,
      title: null,
    })
    .select("id")
    .single();

  if (!chat) redirect(`/projects/${projectId}`);

  redirect(`/projects/${projectId}/chat/${chat.id}`);
}
