"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ChatContainer } from "@/components/chat/chat-container";
import { ChatRouteLoader } from "@/components/chat/chat-route-loader";
import { useAuth } from "@/components/auth-provider";

function NewChatContent() {
  const { user, loading } = useAuth();
  const searchParams = useSearchParams();
  const freshKey = searchParams.get("fresh") || "default";

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

  return <ChatContainer key={`new:${freshKey}`} />;
}

export default function NewChatPage() {
  return (
    <Suspense
      fallback={
        <ChatRouteLoader
          title="Preparing a fresh conversation"
          detail="Setting up the assistant, workspace context, and connected tools."
        />
      }
    >
      <NewChatContent />
    </Suspense>
  );
}
