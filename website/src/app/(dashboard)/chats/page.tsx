"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Clock, Loader2, MessagesSquare, Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/components/auth-provider";
import { DashboardPageHero } from "@/components/dashboard/dashboard-page-hero";
import { createClientLogger } from "@/lib/client-diagnostics";

const log = createClientLogger("ChatsPage");
const RECENT_CHAT_WINDOW_MS = 1000 * 60 * 60 * 24 * 7;

interface Chat {
  id: string;
  title: string | null;
  updated_at: string | null;
}

interface FormattedChat extends Chat {
  dateValue: Date;
}

function toDateValue(value: string | null) {
  if (!value) {
    return new Date(0);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(0);
  }

  return parsed;
}

export default function ChatsPage() {
  const { user, loading: authLoading } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    let cancelled = false;

    async function loadChats() {
      if (!user) {
        setChats([]);
        setLoadedAt(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const token = await user.getIdToken();
        const response = await fetch("/api/dashboard/chats", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) throw new Error("Failed to fetch chats");
        const data = await response.json();
        if (!cancelled) {
          setChats(data.chats || []);
          setLoadedAt(Date.now());
        }
      } catch (error) {
        if (!cancelled) {
          log.error("Error loading chats:", error);
          setChats([]);
          setLoadedAt(Date.now());
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadChats();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  const formattedChats: FormattedChat[] = (chats || [])
    .map((chat) => ({
      ...chat,
      dateValue: toDateValue(chat.updated_at),
    }))
    .sort((left, right) => right.dateValue.getTime() - left.dateValue.getTime());
  const sevenDaysAgo = (loadedAt ?? 0) - RECENT_CHAT_WINDOW_MS;
  const recentChatsCount = loadedAt == null
    ? 0
    : formattedChats.filter((chat) => {
        if (chat.dateValue.getTime() === 0) {
          return false;
        }

        return chat.dateValue.getTime() >= sevenDaysAgo;
      }).length;

  if (authLoading || loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const lastChatLabel = formattedChats[0]
    ? formatDistanceToNow(formattedChats[0].dateValue, { addSuffix: true })
    : "No chats yet";

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 pb-10 md:px-0">
      <DashboardPageHero
        eyebrow="Conversation history"
        title="Chats"
        description="Reopen business briefs, data analysis, research threads, and approved work from your Rearvy history."
        icon={MessagesSquare}
        metrics={[
          { label: "Total", value: formattedChats.length, detail: "saved conversations", icon: MessagesSquare },
          { label: "Recent", value: recentChatsCount, detail: "active this week", icon: Sparkles },
          { label: "Last update", value: lastChatLabel, detail: "latest thread", icon: Clock },
        ]}
        actions={
          <Button asChild className="rounded-[8px]">
            <Link href="/chat/new">
              Start new chat
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        }
      />

      {formattedChats.length === 0 ? (
        <div className="relative overflow-hidden rounded-[8px] border border-dashed border-border/80 bg-card/[0.72] px-5 py-16 text-center shadow-sm">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(105,215,255,0.12),transparent_42%)]"
          />
          <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-[8px] border border-cyan-200/35 bg-cyan-200/10">
            <MessagesSquare className="h-8 w-8 text-cyan-600 dark:text-cyan-100" />
          </div>
          <h3 className="relative mt-5 text-lg font-semibold">No history yet</h3>
          <p className="relative mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            Start a conversation with Rearvy to build a searchable trail of briefs, decisions, and next actions.
          </p>
          <Button asChild className="relative mt-6 rounded-[8px]">
            <Link href="/chat/new">Start your first chat</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {formattedChats.map((chat) => (
            <Link
              key={chat.id}
              href={`/chat/${chat.id}`}
              className="group flex min-h-[168px] flex-col justify-between rounded-[8px] border border-border/70 bg-card/[0.88] p-5 shadow-sm shadow-slate-950/[0.03] transition-all hover:border-cyan-200/45 hover:shadow-md"
            >
              <div>
                <div className="mb-3 flex items-start justify-between">
                  <div className="rounded-[8px] border border-cyan-200/35 bg-cyan-200/10 p-2 text-cyan-600 dark:text-cyan-100">
                    <MessagesSquare className="h-4 w-4" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
                </div>
                <h3 className="line-clamp-2 font-medium leading-tight title-font">
                  {chat.title || "New Chat"}
                </h3>
              </div>
              <div className="mt-6 flex items-center text-xs text-muted-foreground">
                <Clock className="mr-1.5 h-3.5 w-3.5" />
                {formatDistanceToNow(chat.dateValue, { addSuffix: true })}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
