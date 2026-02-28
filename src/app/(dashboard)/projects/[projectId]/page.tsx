"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MessageSquare, Plus, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

interface ProjectDetailPageProps {
  params: Promise<{ projectId: string }>;
}

interface Project {
  id: string;
  name: string;
  description?: string;
}

interface Chat {
  id: string;
  title: string | null;
  updated_at: string;
}

export default function ProjectDetailPage({
  params,
}: ProjectDetailPageProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [projectId, setProjectId] = useState<string>("");
  const [project, setProject] = useState<Project | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then(({ projectId }) => setProjectId(projectId));
  }, [params]);

  useEffect(() => {
    async function loadProjectData() {
      if (!user || !projectId) return;

      try {
        const token = await user.getIdToken();
        const response = await fetch(`/api/dashboard/projects/${projectId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          if (response.status === 404) {
            router.push("/projects");
            return;
          }
          throw new Error("Failed to fetch project");
        }

        const data = await response.json();
        setProject(data.project);
        setChats(data.chats || []);
      } catch (error) {
        console.error("Error loading project:", error);
      } finally {
        setLoading(false);
      }
    }

    if (user && projectId) {
      loadProjectData();
    }
  }, [user, projectId, router]);

  if (authLoading || loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  if (!project) {
    return null;
  }

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
            <Link
              key={chat.id}
              href={`/projects/${projectId}/chat/${chat.id}`}
            >
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
