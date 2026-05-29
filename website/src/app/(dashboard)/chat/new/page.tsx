"use client";

import { use } from "react";
import { ChatContainer } from "@/components/chat/chat-container";
import { useAuth } from "@/components/auth-provider";
import { Loader2 } from "lucide-react";

interface NewChatPageProps {
  searchParams?: Promise<{
    fresh?: string;
    agentId?: string;
  }>;
}

const emptySearchParams = Promise.resolve<{
  fresh?: string;
  agentId?: string;
}>({});

export default function NewChatPage({ searchParams }: NewChatPageProps) {
  const { user, loading } = useAuth();
  const resolvedSearchParams = use(searchParams ?? emptySearchParams);
  const freshKey = resolvedSearchParams.fresh || "default";
  const agentId =
    typeof resolvedSearchParams.agentId === "string" &&
    resolvedSearchParams.agentId.trim()
      ? resolvedSearchParams.agentId.trim()
      : null;

  if (loading) {
    return (
      <div className="flex min-h-0 w-full flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <ChatContainer key={`new:${freshKey}:${agentId || "default"}`} initialAgentId={agentId} />;
}
