import { createClient, getUser } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MessageSquare, Plus } from "lucide-react";

interface ProjectDetailPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectDetailPage({
  params,
}: ProjectDetailPageProps) {
  const { projectId } = await params;

  const { data: { user } } = await getUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) notFound();

  const { data: chats } = await supabase
    .from("chats")
    .select("id, title, updated_at")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          {project.description && (
            <p className="text-muted-foreground">{project.description}</p>
          )}
        </div>
        <Link href={`/projects/${projectId}/chat/new`}>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New chat
          </Button>
        </Link>
      </div>

      {chats && chats.length > 0 ? (
        <div className="space-y-2">
          {chats.map((chat) => (
            <Link key={chat.id} href={`/projects/${projectId}/chat/${chat.id}`}>
              <Card className="cursor-pointer transition-colors hover:bg-accent/50">
                <CardHeader className="py-3">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-sm">
                        {chat.title || "New Chat"}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {new Date(chat.updated_at).toLocaleDateString()}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <MessageSquare className="h-10 w-10 text-muted-foreground/50" />
          <h3 className="mt-4 font-medium">No chats yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Start a conversation within this project
          </p>
        </div>
      )}
    </div>
  );
}
