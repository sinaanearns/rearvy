"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChatContainer } from "@/components/chat/chat-container";
import { useAuth } from "@/components/auth-provider";
import { Loader2 } from "lucide-react";

interface NewProjectChatPageProps {
  params: Promise<{ projectId: string }>;
}

export default function NewProjectChatPage({
  params,
}: NewProjectChatPageProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [projectId, setProjectId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [projectExists, setProjectExists] = useState(true);

  useEffect(() => {
    params.then(({ projectId }) => setProjectId(projectId));
  }, [params]);

  useEffect(() => {
    async function verifyProject() {
      if (!user || !projectId) return;

      try {
        const token = await user.getIdToken();
        const response = await fetch(`/api/dashboard/projects/${projectId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          setProjectExists(false);
          router.push("/projects");
          return;
        }

        setProjectExists(true);
      } catch (error) {
        console.error("Error verifying project:", error);
        setProjectExists(false);
      } finally {
        setLoading(false);
      }
    }

    if (user && projectId) {
      verifyProject();
    }
  }, [user, projectId, router]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-0 w-full flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  if (!projectExists) {
    return null;
  }

  return <ChatContainer key="new" projectId={projectId} />;
}
