"use client";

import { use } from "react";
import { ChatContainer } from "@/components/chat/chat-container";
import { ChatRouteLoader } from "@/components/chat/chat-route-loader";
import { useAuth } from "@/components/auth-provider";

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
      <ChatRouteLoader
        title="Preparing a fresh conversation"
        detail="Setting up the assistant, workspace context, and connected tools."
      />
    );
  }

  if (!user) {
    return null;
  }

  return <ChatContainer key={`new:${freshKey}:${agentId || "default"}`} initialAgentId={agentId} />;
}
