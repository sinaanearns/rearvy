"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getIdToken } from "@/lib/firebase/auth";
import { useAuthContext } from "@/hooks/use-auth-context";
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, MessageSquare, Send, UserPlus } from "lucide-react";

type Thread = {
  chatId: string;
  title: string | null;
  updatedAt: unknown;
  otherUser: {
    id: string;
    username: string | null;
    full_name: string | null;
    email: string | null;
  } | null;
  lastMessage: string;
};

type ChatMessage = {
  id: string;
  role: string;
  sender_id: string | null;
  content: string;
  created_at: unknown;
};

type SuggestedFriend = {
  id: string;
  username: string | null;
  full_name: string | null;
  email: string | null;
};

function getThreadLabel(thread: Thread) {
  if (!thread.otherUser) return thread.title || "Direct message";
  if (thread.otherUser.username) return `@${thread.otherUser.username}`;
  if (thread.otherUser.full_name) return thread.otherUser.full_name;
  if (thread.otherUser.email) return thread.otherUser.email;
  return "Rearvy user";
}

function scrollRail(ref: RefObject<HTMLDivElement | null>, direction: "left" | "right") {
  ref.current?.scrollBy({
    left: direction === "left" ? -360 : 360,
    behavior: "smooth",
  });
}

async function getErrorMessageFromResponse(
  response: Response,
  fallbackMessage: string
) {
  try {
    const payload = (await response.json()) as { error?: unknown };
    if (typeof payload.error === "string" && payload.error.trim().length > 0) {
      return payload.error;
    }
  } catch {
    // Ignore non-JSON responses and use fallback message.
  }

  return fallbackMessage;
}

export default function SocietyMessagesPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [startingChat, setStartingChat] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [friendSuggestions, setFriendSuggestions] = useState<SuggestedFriend[]>([]);
  const [followRequestLoadingId, setFollowRequestLoadingId] = useState<string | null>(null);
  const [requestedUserIds, setRequestedUserIds] = useState<Record<string, boolean>>({});
  const suggestionRailRef = useRef<HTMLDivElement>(null);
  const threadRailRef = useRef<HTMLDivElement>(null);

  const router = useRouter();
  const { user, loading: authLoading } = useAuthContext();

  const activeThread = useMemo(
    () => threads.find((thread) => thread.chatId === activeChatId) || null,
    [threads, activeChatId]
  );

  const authorizedFetch = useCallback(async (input: RequestInfo | URL, init?: RequestInit) => {
    const token = await getIdToken();
    if (!token) {
      throw new Error("Missing auth token. Please sign in again.");
    }

    return fetch(input, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.headers || {}),
      },
    });
  }, []);

  const loadMessages = useCallback(async (chatId: string) => {
    try {
      setLoadingMessages(true);
      setError(null);

      const response = await authorizedFetch(`/api/society/messages/${chatId}`);
      if (!response.ok) {
        throw new Error(await getErrorMessageFromResponse(response, "Failed to load messages"));
      }

      const data = (await response.json()) as { messages: ChatMessage[] };
      setMessages(Array.isArray(data.messages) ? data.messages : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
    } finally {
      setLoadingMessages(false);
    }
  }, [authorizedFetch]);

  const loadSuggestions = useCallback(async () => {
    try {
      setLoadingSuggestions(true);

      const response = await authorizedFetch("/api/society/messages/suggestions");
      if (!response.ok) {
        throw new Error(
          await getErrorMessageFromResponse(response, "Failed to load friend suggestions")
        );
      }

      const data = (await response.json()) as { suggestions: SuggestedFriend[] };
      setFriendSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
    } catch {
      setFriendSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, [authorizedFetch]);

  const loadThreads = useCallback(async () => {
    try {
      setLoadingThreads(true);
      setError(null);

      const response = await authorizedFetch("/api/society/messages/threads");
      if (!response.ok) {
        throw new Error(
          await getErrorMessageFromResponse(response, "Failed to load message threads")
        );
      }

      const data = (await response.json()) as { threads: Thread[] };
      const threadList = Array.isArray(data.threads) ? data.threads : [];
      setThreads(threadList);

      let nextChatId: string | null = null;
      setActiveChatId((currentChatId) => {
        if (!currentChatId && threadList.length > 0) {
          nextChatId = threadList[0].chatId;
          return nextChatId;
        }

        return currentChatId;
      });

      if (nextChatId) {
        await loadMessages(nextChatId);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load threads");
    } finally {
      setLoadingThreads(false);
    }
  }, [authorizedFetch, loadMessages]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace("/society/login?redirect=%2Fsociety%2Fmessages");
      return;
    }

    void loadThreads();
    void loadSuggestions();
  }, [authLoading, user, router, loadThreads, loadSuggestions]);

  async function startChatByUsername(rawUsername: string) {
    const username = rawUsername.trim();
    if (!username) return;

    try {
      setStartingChat(true);
      setError(null);

      const response = await authorizedFetch("/api/society/messages/start", {
        method: "POST",
        body: JSON.stringify({ username }),
      });

      const payload = (await response.json()) as { error?: string; chatId?: string };

      if (!response.ok || !payload.chatId) {
        throw new Error(payload.error || "Unable to start conversation");
      }

      setUsernameInput("");
      await loadThreads();
      await loadSuggestions();
      setActiveChatId(payload.chatId);
      await loadMessages(payload.chatId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to start conversation");
    } finally {
      setStartingChat(false);
    }
  }

  async function handleStartChat(e: FormEvent) {
    e.preventDefault();

    await startChatByUsername(usernameInput);
  }

  async function sendFollowRequest(userId: string) {
    if (!userId || userId === user?.uid) {
      return;
    }

    try {
      setFollowRequestLoadingId(userId);
      setError(null);

      const response = await authorizedFetch(`/api/users/${userId}/follow-request`, {
        method: "POST",
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string; status?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Unable to send follow request");
      }

      setRequestedUserIds((current) => ({
        ...current,
        [userId]: true,
      }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to send follow request");
    } finally {
      setFollowRequestLoadingId(null);
    }
  }

  async function handleSendMessage(e: FormEvent) {
    e.preventDefault();

    if (!activeChatId) {
      setError("Select or start a conversation first.");
      return;
    }

    const content = messageInput.trim();
    if (!content) return;

    try {
      setSending(true);
      setError(null);

      const response = await authorizedFetch(`/api/society/messages/${activeChatId}`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Unable to send message");
      }

      setMessageInput("");
      await loadMessages(activeChatId);
      await loadThreads();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to send message");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Rearvy User Messages
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleStartChat} className="flex flex-col gap-3 sm:flex-row">
            <Input
              placeholder="Start by username, e.g. @jane"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
            />
            <Button type="submit" disabled={startingChat}>
                {startingChat ? "Starting..." : "Start conversation"}
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
              Use a Rearvy username to start a conversation.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Friend Suggestions</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" size="icon-sm" variant="outline" onClick={() => scrollRail(suggestionRailRef, "left")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon-sm" variant="outline" onClick={() => scrollRail(suggestionRailRef, "right")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingSuggestions && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading suggestions...
            </div>
          )}

          {!loadingSuggestions && friendSuggestions.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No suggestions right now. Try searching by username above.
            </p>
          )}

          {!loadingSuggestions && friendSuggestions.length > 0 && (
            <div
              ref={suggestionRailRef}
              className="flex gap-3 overflow-x-auto pb-2 pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {friendSuggestions.map((friend) => {
                const username = friend.username || "";
                const usernameTag = username ? `@${username}` : "Rearvy user";
                const subtitle = friend.full_name || friend.email || "Rearvy member";
                const requestSent = requestedUserIds[friend.id] === true;

                return (
                  <div
                    key={friend.id}
                    className="min-w-[280px] shrink-0 rounded-2xl border border-border/60 bg-background/60 p-4"
                  >
                    <div className="space-y-1">
                      <p className="truncate text-sm font-medium">{usernameTag}</p>
                      <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/users/${friend.id}`}>
                          <ExternalLink className="h-4 w-4" />
                          View profile
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={followRequestLoadingId === friend.id || requestSent}
                        onClick={() => void sendFollowRequest(friend.id)}
                      >
                        <UserPlus className="h-4 w-4" />
                        {requestSent ? "Request sent" : followRequestLoadingId === friend.id ? "Sending..." : "Follow"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={startingChat || !username}
                        onClick={async () => {
                          if (!username) return;
                          await startChatByUsername(username);
                        }}
                      >
                        Open chat
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="text-base">Conversation users</CardTitle>
              <div className="flex items-center gap-2">
                <Button type="button" size="icon-sm" variant="outline" onClick={() => scrollRail(threadRailRef, "left")}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon-sm" variant="outline" onClick={() => scrollRail(threadRailRef, "right")}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
          </CardHeader>
          <CardContent>
            {loadingThreads && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                  Loading users...
              </div>
            )}

            {!loadingThreads && threads.length === 0 && (
                <p className="text-sm text-muted-foreground">No users in conversation yet.</p>
            )}

            {!loadingThreads && threads.length > 0 && (
              <div
                ref={threadRailRef}
                className="flex gap-3 overflow-x-auto pb-2 pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {threads.map((thread) => {
                  const otherUser = thread.otherUser;
                  const requestKey = otherUser?.id || thread.chatId;
                  const requestSent = requestedUserIds[requestKey] === true;

                  return (
                    <div
                      key={thread.chatId}
                      className={`min-w-[280px] shrink-0 rounded-2xl border p-4 text-left transition-colors hover:bg-accent/40 ${
                        activeChatId === thread.chatId ? "border-primary bg-accent/30" : "border-border/60 bg-background/60"
                      }`}
                    >
                      <button
                        className="w-full text-left"
                        onClick={async () => {
                          setActiveChatId(thread.chatId);
                          await loadMessages(thread.chatId);
                        }}
                      >
                        <p className="text-sm font-medium">{getThreadLabel(thread)}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {thread.lastMessage || "No messages yet"}
                        </p>
                      </button>

                      {otherUser && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/users/${otherUser.id}`}>
                              <ExternalLink className="h-4 w-4" />
                              View profile
                            </Link>
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={followRequestLoadingId === requestKey || requestSent}
                            onClick={() => void sendFollowRequest(otherUser.id)}
                          >
                            <UserPlus className="h-4 w-4" />
                            {requestSent ? "Request sent" : followRequestLoadingId === requestKey ? "Sending..." : "Follow"}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
              <CardTitle className="text-base">
                {activeThread ? getThreadLabel(activeThread) : "Select a user"}
              </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="min-h-[340px] space-y-3 rounded-lg border p-3">
              {loadingMessages && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading messages...
                </div>
              )}

              {!loadingMessages && activeChatId && messages.length === 0 && (
                <p className="text-sm text-muted-foreground">Send a message to start the user conversation.</p>
              )}

              {!loadingMessages &&
                messages.map((message) => {
                  const ownMessage = message.sender_id === user?.uid;
                  return (
                    <div
                      key={message.id}
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        ownMessage
                          ? "ml-auto bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      {message.content}
                    </div>
                  );
                })}
            </div>

            <form onSubmit={handleSendMessage} className="flex gap-2">
              <Input
                  placeholder={activeChatId ? "Type your message..." : "Select a user first"}
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                disabled={!activeChatId || sending}
              />
              <Button type="submit" disabled={!activeChatId || sending}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
