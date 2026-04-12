"use client";

import { use } from "react";
import { ChatContainer } from "@/components/chat/chat-container";
import { useAuth } from "@/components/auth-provider";
import { Loader2 } from "lucide-react";

interface NewChatPageProps {
  searchParams?: Promise<{
    fresh?: string;
  }>;
}

const emptySearchParams = Promise.resolve<{
  fresh?: string;
}>({});

export default function NewChatPage({ searchParams }: NewChatPageProps) {
  const { user, loading } = useAuth();
  const resolvedSearchParams = use(searchParams ?? emptySearchParams);
  const freshKey = resolvedSearchParams.fresh || "default";

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <ChatContainer key={`new:${freshKey}`} />;
}
