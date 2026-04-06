"use client";
/* eslint-disable @next/next/no-img-element */

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChatAttachmentList } from "@/components/chat/chat-attachment-list";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getIdToken } from "@/lib/firebase/auth";
import {
  type ChatAttachment,
  MAX_CHAT_ATTACHMENTS_PER_MESSAGE,
  MAX_CHAT_ATTACHMENT_SIZE_BYTES,
  formatChatAttachmentSize,
  isImageContentType,
} from "@/lib/chat/attachments";
import { useAuthContext } from "@/hooks/use-auth-context";
import { ExternalLink, FileText, Loader2, MessageSquare, Paperclip, Search, Send, UserPlus, X } from "lucide-react";

type Thread = {
  chatId: string;
  title: string | null;
  updatedAt: unknown;
  lastMessageAt?: number;
  threadType?: "user_dm" | "admin_dm";
  otherUser: {
    id: string;
    username: string | null;
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
  lastMessage: string;
};

type ChatMessage = {
  id: string;
  role: string;
  sender_id: string | null;
  content: string;
  created_at: unknown;
  attachments?: ChatAttachment[];
};

type SuggestedFriend = {
  id: string;
  username: string | null;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

type StartChatTarget = {
  id: string;
  username: string | null;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

type PendingAttachment = {
  id: string;
  file: File;
  previewUrl: string | null;
};

function getThreadLabel(thread: Thread) {
  if (!thread.otherUser) return thread.title || "Direct message";
  if (thread.otherUser.username) return `@${thread.otherUser.username}`;
  if (thread.otherUser.full_name) return thread.otherUser.full_name;
  if (thread.otherUser.email) return thread.otherUser.email;
  return "Rearvy user";
}

function createPendingAttachment(file: File): PendingAttachment {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    file,
    previewUrl: isImageContentType(file.type) ? URL.createObjectURL(file) : null,
  };
}

function normalizePastedImage(file: File, index: number) {
  if (file.name) {
    return file;
  }

  const extension = file.type.split("/")[1] || "png";
  return new File([file], `pasted-image-${Date.now()}-${index}.${extension}`, {
    type: file.type || "image/png",
    lastModified: Date.now(),
  });
}

function getProfileInitials(value: string) {
  const parts = value
    .replace(/^@/, "")
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "R";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return parts.map((part) => part[0]?.toUpperCase() || "").join("");
}

function upsertThread(threads: Thread[], nextThread: Thread) {
  const existingIndex = threads.findIndex((thread) => thread.chatId === nextThread.chatId);
  if (existingIndex === -1) {
    return [nextThread, ...threads];
  }

  const updated = [...threads];
  updated[existingIndex] = {
    ...updated[existingIndex],
    ...nextThread,
    otherUser: nextThread.otherUser || updated[existingIndex].otherUser,
  };

  return updated;
}

function getTimestampMs(value: unknown): number {
  if (value && typeof value === "object") {
    const timestampValue = value as {
      _seconds?: unknown;
      _nanoseconds?: unknown;
      seconds?: unknown;
      nanoseconds?: unknown;
    };

    const seconds =
      typeof timestampValue._seconds === "number"
        ? timestampValue._seconds
        : typeof timestampValue.seconds === "number"
          ? timestampValue.seconds
          : null;
    const nanoseconds =
      typeof timestampValue._nanoseconds === "number"
        ? timestampValue._nanoseconds
        : typeof timestampValue.nanoseconds === "number"
          ? timestampValue.nanoseconds
          : 0;

    if (seconds !== null) {
      return seconds * 1000 + Math.floor(nanoseconds / 1_000_000);
    }
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" || value instanceof Date) {
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  return 0;
}

function formatThreadTime(thread: Thread) {
  const timestamp = Math.max(getTimestampMs(thread.updatedAt), thread.lastMessageAt || 0);
  if (!timestamp) {
    return "";
  }

  const date = new Date(timestamp);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfMessageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

  if (startOfMessageDay === startOfToday) {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  if (startOfToday - startOfMessageDay < 6 * 24 * 60 * 60 * 1000) {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
    }).format(date);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatMessageTime(value: unknown) {
  const timestamp = getTimestampMs(value);
  if (!timestamp) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function isAdminThread(thread: Thread | null | undefined) {
  return thread?.threadType === "admin_dm";
}

function getUserSubtitle(
  person: Pick<StartChatTarget, "full_name" | "email"> | null | undefined,
  fallback = "Rearvy member"
) {
  return person?.full_name || person?.email || fallback;
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
  const [otherParticipantLastReadAt, setOtherParticipantLastReadAt] = useState<number | null>(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [friendSuggestions, setFriendSuggestions] = useState<SuggestedFriend[]>([]);
  const [followRequestLoadingId, setFollowRequestLoadingId] = useState<string | null>(null);
  const [requestedUserIds, setRequestedUserIds] = useState<Record<string, boolean>>({});

  const router = useRouter();
  const { user, loading: authLoading } = useAuthContext();
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const pendingAttachmentsRef = useRef<PendingAttachment[]>([]);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.chatId === activeChatId) || null,
    [threads, activeChatId]
  );
  const activeOtherUser = activeThread?.otherUser || null;
  const activeRequestKey = activeOtherUser?.id || activeThread?.chatId || null;
  const activeRequestSent = activeRequestKey ? requestedUserIds[activeRequestKey] === true : false;
  const activeProfileLabel = activeThread ? getThreadLabel(activeThread) : "Rearvy user";
  const activeSubtitle = activeThread
    ? isAdminThread(activeThread)
      ? "Official messages from the Rearvy admin team"
      : getUserSubtitle(activeOtherUser, "Start or select a conversation")
    : "Start or select a conversation";
  const currentUserLabel = user?.displayName || user?.email || "Rearvy user";
  const currentUserInitials = getProfileInitials(currentUserLabel);
  const latestOwnMessageId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index]?.sender_id === user?.uid) {
        return messages[index].id;
      }
    }

    return null;
  }, [messages, user?.uid]);

  const authorizedFetch = useCallback(async (input: RequestInfo | URL, init?: RequestInit) => {
    const token = await getIdToken();
    if (!token) {
      throw new Error("Missing auth token. Please sign in again.");
    }

    const nextHeaders = new Headers(init?.headers || {});
    nextHeaders.set("Authorization", `Bearer ${token}`);

    const isFormDataBody =
      typeof FormData !== "undefined" && init?.body instanceof FormData;
    if (!isFormDataBody && !nextHeaders.has("Content-Type")) {
      nextHeaders.set("Content-Type", "application/json");
    }

    return fetch(input, {
      ...init,
      headers: nextHeaders,
    });
  }, []);

  const revokePendingAttachmentPreviews = useCallback((attachments: PendingAttachment[]) => {
    attachments.forEach((attachment) => {
      if (attachment.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
      }
    });
  }, []);

  const appendPendingAttachments = useCallback((files: File[]) => {
    if (files.length === 0) {
      return;
    }

    setPendingAttachments((current) => {
      const slotsLeft = Math.max(MAX_CHAT_ATTACHMENTS_PER_MESSAGE - current.length, 0);
      if (slotsLeft === 0) {
        setError(`You can send up to ${MAX_CHAT_ATTACHMENTS_PER_MESSAGE} attachments at once.`);
        return current;
      }

      const acceptedFiles: File[] = [];
      for (const file of files) {
        if (acceptedFiles.length >= slotsLeft) {
          break;
        }

        if (file.size > MAX_CHAT_ATTACHMENT_SIZE_BYTES) {
          setError(`"${file.name}" is larger than 15MB.`);
          continue;
        }

        acceptedFiles.push(file);
      }

      if (acceptedFiles.length === 0) {
        return current;
      }

      setError(null);
      return [...current, ...acceptedFiles.map((file) => createPendingAttachment(file))];
    });
  }, []);

  const removePendingAttachment = useCallback((attachmentId: string) => {
    setPendingAttachments((current) => {
      const attachment = current.find((item) => item.id === attachmentId);
      if (attachment?.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
      }

      return current.filter((item) => item.id !== attachmentId);
    });
  }, []);

  const uploadPendingAttachment = useCallback(async (chatId: string, file: File) => {
    const formData = new FormData();
    formData.set("chatId", chatId);
    formData.set("file", file);

    const response = await authorizedFetch("/api/society/messages/attachments", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(
        await getErrorMessageFromResponse(response, "Failed to upload attachment")
      );
    }

    const payload = (await response.json()) as { attachment?: ChatAttachment };
    if (!payload.attachment) {
      throw new Error("Attachment upload did not return file metadata");
    }

    return payload.attachment;
  }, [authorizedFetch]);

  const loadMessages = useCallback(async (chatId: string, options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) {
        setLoadingMessages(true);
      }
      setError(null);

      const response = await authorizedFetch(`/api/society/messages/${chatId}`);
      if (!response.ok) {
        throw new Error(await getErrorMessageFromResponse(response, "Failed to load messages"));
      }

      const data = (await response.json()) as {
        messages: ChatMessage[];
        chat?: {
          otherParticipantLastReadAt?: number;
        };
      };
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setOtherParticipantLastReadAt(
        typeof data.chat?.otherParticipantLastReadAt === "number"
          ? data.chat.otherParticipantLastReadAt
          : null
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
    } finally {
      if (!options?.silent) {
        setLoadingMessages(false);
      }
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

  const loadThreads = useCallback(async (fallbackThread?: Thread, options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) {
        setLoadingThreads(true);
      }
      setError(null);

      const response = await authorizedFetch("/api/society/messages/threads");
      if (!response.ok) {
        throw new Error(
          await getErrorMessageFromResponse(response, "Failed to load message threads")
        );
      }

      const data = (await response.json()) as { threads: Thread[] };
      const baseThreadList = Array.isArray(data.threads) ? data.threads : [];
      const threadList =
        fallbackThread && !baseThreadList.some((thread) => thread.chatId === fallbackThread.chatId)
          ? upsertThread(baseThreadList, fallbackThread)
          : baseThreadList;

      setThreads(threadList);

      let nextChatId: string | null = null;
      setActiveChatId((currentChatId) => {
        if (threadList.length === 0) {
          setMessages([]);
          setOtherParticipantLastReadAt(null);
          return null;
        }

        if (currentChatId && threadList.some((thread) => thread.chatId === currentChatId)) {
          return currentChatId;
        }

        if (threadList.length > 0) {
          nextChatId = threadList[0].chatId;
          return nextChatId;
        }

        return currentChatId;
      });

      if (nextChatId) {
        await loadMessages(nextChatId, options);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load threads");
    } finally {
      if (!options?.silent) {
        setLoadingThreads(false);
      }
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

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    const refreshChatSurface = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      await loadThreads(undefined, { silent: true });

      if (activeChatId) {
        await loadMessages(activeChatId, { silent: true });
      }
    };

    const intervalId = window.setInterval(() => {
      void refreshChatSurface();
    }, 8000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [authLoading, user, activeChatId, loadThreads, loadMessages]);

  useEffect(() => {
    if (!activeChatId || loadingMessages) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      messageEndRef.current?.scrollIntoView({
        block: "end",
      });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeChatId, loadingMessages, messages]);

  useEffect(() => {
    pendingAttachmentsRef.current = pendingAttachments;
  }, [pendingAttachments]);

  useEffect(() => {
    return () => {
      revokePendingAttachmentPreviews(pendingAttachmentsRef.current);
    };
  }, [revokePendingAttachmentPreviews]);

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

      const payload = (await response.json()) as {
        error?: string;
        chatId?: string;
        target?: StartChatTarget | null;
        threadType?: Thread["threadType"];
        threadTitle?: string | null;
      };

      if (!response.ok || !payload.chatId) {
        throw new Error(payload.error || "Unable to start conversation");
      }

      const optimisticThread: Thread = {
        chatId: payload.chatId,
        title:
          payload.threadTitle ||
          (payload.target?.username ? `@${payload.target.username}` : null),
        updatedAt: Date.now(),
        threadType: payload.threadType || "user_dm",
        otherUser:
          payload.threadType === "admin_dm" || !payload.target
            ? null
            : {
                id: payload.target.id,
                username: payload.target.username,
                full_name: payload.target.full_name,
                email: payload.target.email,
                avatar_url: payload.target.avatar_url,
              },
        lastMessage: "",
      };

      setUsernameInput("");
      revokePendingAttachmentPreviews(pendingAttachmentsRef.current);
      setPendingAttachments([]);
      setThreads((current) => upsertThread(current, optimisticThread));
      setActiveChatId(payload.chatId);
      setMessages([]);
      await loadThreads(optimisticThread);
      await loadSuggestions();
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

  async function selectThread(chatId: string) {
    revokePendingAttachmentPreviews(pendingAttachmentsRef.current);
    setPendingAttachments([]);
    setActiveChatId(chatId);
    await loadMessages(chatId);
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

  function handleAttachmentSelection(files: File[]) {
    appendPendingAttachments(files);
    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = "";
    }
  }

  function handleComposerPaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const imageFilesFromItems = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item, index) => {
        const file = item.getAsFile();
        return file ? normalizePastedImage(file, index) : null;
      })
      .filter((file): file is File => Boolean(file));

    const imageFiles =
      imageFilesFromItems.length > 0
        ? imageFilesFromItems
        : Array.from(event.clipboardData.files)
            .filter((file) => file.type.startsWith("image/"))
            .map(normalizePastedImage);

    if (imageFiles.length === 0) {
      return;
    }

    event.preventDefault();
    appendPendingAttachments(imageFiles);
  }

  async function handleSendMessage(e: FormEvent) {
    e.preventDefault();

    if (!activeChatId) {
      setError("Select or start a conversation first.");
      return;
    }

    const content = messageInput.trim();
    if (!content && pendingAttachments.length === 0) return;

    try {
      setSending(true);
      setError(null);
      const uploadedAttachments =
        pendingAttachments.length > 0
          ? await Promise.all(
              pendingAttachments.map((attachment) =>
                uploadPendingAttachment(activeChatId, attachment.file)
              )
            )
          : [];

      const response = await authorizedFetch(`/api/society/messages/${activeChatId}`, {
        method: "POST",
        body: JSON.stringify({ content, attachments: uploadedAttachments }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Unable to send message");
      }

      revokePendingAttachmentPreviews(pendingAttachments);
      setPendingAttachments([]);
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
    <div className="relative min-h-screen overflow-hidden bg-[#080808] text-foreground">
      {error && (
        <div className="absolute left-4 right-20 top-4 z-20 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive backdrop-blur">
          {error}
        </div>
      )}

      <button
        type="button"
        aria-label="Close messages"
        onClick={() => router.push("/society")}
        className="absolute right-4 top-4 z-20 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/70 text-white shadow-[0_18px_40px_rgba(0,0,0,0.45)] backdrop-blur transition hover:bg-black"
      >
        <X className="h-5 w-5" />
      </button>

      <section className="relative min-h-screen overflow-hidden border border-white/8 bg-[#161616] shadow-[0_24px_80px_rgba(0,0,0,0.4)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.03),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_38%)]" />

        <div className="relative grid min-h-screen lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="flex min-h-0 min-w-0 flex-col border-b border-white/6 bg-[#171717] backdrop-blur-xl lg:border-r lg:border-b-0">
            <div className="border-b border-white/6 px-6 pb-4 pt-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.42em] text-white/35">Rearvy Inbox</p>
                  <h1 className="mt-4 flex items-center gap-3 text-[15px] font-semibold tracking-tight text-white">
                    <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-white text-black shadow-[0_12px_30px_rgba(255,255,255,0.08)]">
                      <MessageSquare className="h-4 w-4" />
                    </span>
                    Messages
                  </h1>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] text-white/45">
                  {threads.length} chats
                </div>
              </div>

              <form onSubmit={handleStartChat} className="mt-5 space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
                  <Input
                    className="h-10 rounded-full border-white/6 bg-black/20 pl-10 text-[12px] text-white placeholder:text-white/28 focus-visible:border-white/10 focus-visible:ring-0"
                    placeholder="Search username or start a DM"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={startingChat}
                  className="h-9 w-full rounded-full bg-white text-black hover:bg-white/90"
                >
                  {startingChat ? "Opening conversation..." : "Start conversation"}
                </Button>
                <p className="text-[10px] leading-4 text-white/32">
                  Use a Rearvy username like `@jane` to open a direct message.
                </p>
              </form>
            </div>

            <div className="border-b border-white/6 px-6 py-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">Suggestions</p>
                  <p className="text-[10px] text-white/30">Story-style shortcuts to new chats</p>
                </div>
                {friendSuggestions.length > 0 && (
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/45">
                    {friendSuggestions.length}
                  </span>
                )}
              </div>

              {loadingSuggestions && (
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading suggestions...
                </div>
              )}

              {!loadingSuggestions && friendSuggestions.length === 0 && (
                <p className="mt-4 text-sm text-muted-foreground">
                  No suggestions right now. Search above to start a new chat.
                </p>
              )}

              {!loadingSuggestions && friendSuggestions.length > 0 && (
                <div className="mt-4 flex gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {friendSuggestions.map((friend) => {
                    const username = friend.username || "";
                    const usernameTag = username ? `@${username}` : "Rearvy user";
                    const requestSent = requestedUserIds[friend.id] === true;
                    const profileLabel = friend.full_name || usernameTag || friend.email || "Rearvy member";

                    return (
                    <div key={friend.id} className="w-[86px] shrink-0 text-center xl:w-[92px]">
                        <button
                          type="button"
                          className="group flex w-full flex-col items-center gap-2"
                          disabled={startingChat || !username}
                          onClick={async () => {
                            if (!username) return;
                            await startChatByUsername(username);
                          }}
                        >
                          <span className="rounded-full border border-white/10 bg-black/25 p-[4px] shadow-[0_10px_24px_rgba(0,0,0,0.2)] transition-transform duration-200 group-hover:scale-[1.03]">
                            <span className="block rounded-full bg-[#111111] p-[3px]">
                              <Avatar className="h-14 w-14 border border-white/8">
                                <AvatarImage src={friend.avatar_url || undefined} alt={profileLabel} />
                                <AvatarFallback className="bg-[#2f2f2f] font-semibold text-white">
                                  {getProfileInitials(profileLabel)}
                                </AvatarFallback>
                              </Avatar>
                            </span>
                          </span>
                          <span className="w-full truncate text-[11px] font-medium text-white">{usernameTag}</span>
                        </button>
                        <div className="mt-2 flex items-center justify-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 rounded-full border border-white/10 bg-black/20 px-3 text-[10px] text-white hover:bg-white/10"
                            disabled={followRequestLoadingId === friend.id || requestSent}
                            onClick={() => void sendFollowRequest(friend.id)}
                          >
                            {requestSent ? "Sent" : "Follow"}
                          </Button>
                          <Button
                            asChild
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            className="h-7 w-7 rounded-full border border-white/10 bg-black/20 text-white hover:bg-white/10"
                          >
                            <Link href={`/users/${friend.id}`}>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="min-h-0 flex-1 px-5 py-5">
              <div className="mb-3 flex items-center justify-between px-1">
                <p className="text-[10px] uppercase tracking-[0.35em] text-white/32">Inbox</p>
                <p className="text-[10px] text-white/35">{loadingThreads ? "Syncing..." : `${threads.length} active`}</p>
              </div>

              {loadingThreads && (
                <div className="flex items-center gap-2 rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/45">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading conversations...
                </div>
              )}

              {!loadingThreads && threads.length === 0 && (
                <div className="rounded-[28px] border border-dashed border-white/8 bg-white/[0.02] px-5 py-6 text-sm text-white/38">
                  No conversations yet. Start one from the search bar above.
                </div>
              )}

              {!loadingThreads && threads.length > 0 && (
                <div className="space-y-2 overflow-y-auto pr-1 lg:max-h-[calc(100vh-420px)]">
                  {threads.map((thread) => {
                    const otherUser: Thread["otherUser"] = thread.otherUser;
                    const threadLabel = getThreadLabel(thread);
                    const subtitle = isAdminThread(thread)
                      ? thread.lastMessage || "Official Rearvy admin chat"
                      : thread.lastMessage || getUserSubtitle(otherUser, "No messages yet");
                    const threadTime = formatThreadTime(thread);

                    return (
                      <div
                        key={thread.chatId}
                        role="button"
                        tabIndex={0}
                        className={`group flex w-full items-center gap-3 rounded-[26px] border px-3 py-3 text-left transition-all ${
                          activeChatId === thread.chatId
                            ? "border-white/10 bg-white/[0.05] shadow-[0_14px_30px_rgba(0,0,0,0.2)]"
                            : "border-transparent bg-transparent hover:border-white/8 hover:bg-white/[0.03]"
                        }`}
                        onClick={() => {
                          void selectThread(thread.chatId);
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" && event.key !== " ") {
                            return;
                          }

                          event.preventDefault();
                          void selectThread(thread.chatId);
                        }}
                      >
                        {otherUser ? (
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <Link
                              href={`/users/${otherUser.id}`}
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => event.stopPropagation()}
                              className="flex min-w-0 items-center gap-3"
                              aria-label={`Open ${threadLabel} profile`}
                            >
                              <div className="rounded-full border border-white/10 bg-black/20 p-[2px] shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
                                <Avatar className="h-12 w-12 border border-white/8 bg-[#111111]">
                                  <AvatarImage
                                    src={otherUser.avatar_url || undefined}
                                    alt={otherUser.full_name || threadLabel}
                                  />
                                  <AvatarFallback className="bg-[#5b61cf] font-semibold text-white">
                                    {getProfileInitials(otherUser.full_name || threadLabel)}
                                  </AvatarFallback>
                                </Avatar>
                              </div>

                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-white">{threadLabel}</p>
                                <p className="mt-1 truncate text-xs text-white/42">{subtitle}</p>
                              </div>
                            </Link>
                            {threadTime && (
                              <span className="ml-auto shrink-0 text-[10px] text-white/35">{threadTime}</span>
                            )}
                          </div>
                        ) : (
                          <>
                            <div className="rounded-full border border-white/10 bg-black/20 p-[2px] shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
                              <Avatar className="h-12 w-12 border border-white/8 bg-[#111111]">
                                <AvatarImage
                                  src={undefined}
                                  alt={threadLabel}
                                />
                                <AvatarFallback className="bg-[#5b61cf] font-semibold text-white">
                                  {getProfileInitials(threadLabel)}
                                </AvatarFallback>
                              </Avatar>
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-3">
                                <p className="truncate text-sm font-medium text-white">{threadLabel}</p>
                                {threadTime && (
                                  <span className="shrink-0 text-[10px] text-white/35">{threadTime}</span>
                                )}
                              </div>
                              <p className="mt-1 truncate text-xs text-white/42">{subtitle}</p>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-auto px-5 pb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/25 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(0,0,0,0.28)]">
                {currentUserInitials}
              </div>
            </div>
          </aside>

          <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#171717] backdrop-blur-sm">
            <div className="border-b border-white/6 px-4 py-4 sm:px-6">
              {activeThread ? (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="rounded-full border border-white/10 bg-black/25 p-[2px] shadow-[0_10px_24px_rgba(0,0,0,0.12)]">
                      <Avatar className="h-12 w-12 border border-white/8 bg-[#111111]">
                        <AvatarImage src={activeOtherUser?.avatar_url || undefined} alt={activeProfileLabel} />
                        <AvatarFallback className="bg-[#5b61cf] text-base font-semibold text-white">
                          {getProfileInitials(activeProfileLabel)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-white">{activeProfileLabel}</p>
                      <p className="text-[11px] text-white/35">{activeSubtitle}</p>
                    </div>
                  </div>

                  {activeOtherUser && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        asChild
                        type="button"
                        variant="ghost"
                        className="h-9 rounded-full border border-white/10 bg-black/20 px-4 text-white hover:bg-white/10"
                      >
                        <Link href={`/users/${activeOtherUser.id}`}>
                          <ExternalLink className="h-4 w-4" />
                          View profile
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-9 rounded-full border border-white/10 bg-black/20 px-4 text-white hover:bg-white/10"
                        disabled={followRequestLoadingId === activeRequestKey || activeRequestSent}
                        onClick={() => void sendFollowRequest(activeOtherUser.id)}
                      >
                        <UserPlus className="h-4 w-4" />
                        {activeRequestSent
                          ? "Request sent"
                          : followRequestLoadingId === activeRequestKey
                            ? "Sending..."
                            : "Follow"}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="min-w-0">
                  <p className="text-sm font-semibold uppercase tracking-[0.3em] text-white/30">
                    Direct messages
                  </p>
                  <h2 className="mt-2 break-words text-2xl font-semibold text-white">Select a conversation</h2>
                  <p className="mt-1 max-w-2xl break-words text-sm text-white/40">
                    Choose someone from the inbox to open the chat, or search for a username to start a new one.
                  </p>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-x-hidden overflow-y-auto px-4 py-6 sm:px-6">
              {!activeThread && (
                <div className="mx-auto flex h-full min-h-[420px] w-full max-w-2xl flex-col items-center justify-center px-4 text-center">
                  <div className="rounded-full border border-white/8 bg-white/[0.03] px-5 py-2 text-[10px] uppercase tracking-[0.45em] text-white/35">
                    New thread
                  </div>
                  <h3 className="mt-8 text-4xl font-semibold tracking-tight text-white">Say hi to someone</h3>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-white/34">
                    This conversation is empty right now. Send the first message to get things moving.
                  </p>
                </div>
              )}

              {activeThread && loadingMessages && (
                <div className="flex h-full min-h-[420px] items-center justify-center gap-3 text-sm text-white/40">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading messages...
                </div>
              )}

              {activeThread && !loadingMessages && messages.length === 0 && (
                <div className="mx-auto flex h-full min-h-[420px] w-full max-w-2xl flex-col items-center justify-center px-4 text-center">
                  <div className="rounded-full border border-white/8 bg-white/[0.03] px-5 py-2 text-[10px] uppercase tracking-[0.45em] text-white/35">
                    New thread
                  </div>
                  <h3 className="mt-8 text-[18px] font-semibold text-white">Say hi to {activeProfileLabel}</h3>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-white/34">
                    This conversation is empty right now. Send the first message to get things moving.
                  </p>
                </div>
              )}

              {activeThread && !loadingMessages && messages.length > 0 && (
                <div className="flex min-h-full w-full flex-col justify-end">
                  <div className="flex w-full flex-col gap-4 pb-2">
                  {messages.map((message) => {
                    const ownMessage = message.sender_id === user?.uid;
                    const messageTime = formatMessageTime(message.created_at);
                    const hasContent = Boolean(message.content?.trim());
                    const attachments = message.attachments || [];
                    const latestOwnMessage =
                      ownMessage && latestOwnMessageId !== null && message.id === latestOwnMessageId;
                    const messageSeen =
                      latestOwnMessage &&
                      typeof otherParticipantLastReadAt === "number" &&
                      otherParticipantLastReadAt >= getTimestampMs(message.created_at);
                    const receiptLabel = latestOwnMessage
                      ? messageSeen
                        ? "Seen"
                        : "Sent"
                      : null;

                    return (
                      <div
                        key={message.id}
                        className={`flex w-full ${ownMessage ? "justify-end" : "justify-start"}`}
                        >
                          <div
                          className={`flex max-w-[min(78%,40rem)] flex-col ${
                            ownMessage ? "items-end" : "items-start"
                          }`}
                        >
                          {hasContent ? (
                            <div
                              className={`rounded-[26px] px-4 py-3 text-sm leading-6 shadow-lg ${
                                ownMessage
                                  ? "bg-[#303f5a] text-white shadow-[0_16px_32px_rgba(0,0,0,0.16)]"
                                  : "border border-white/8 bg-white/[0.04] text-white backdrop-blur"
                              }`}
                            >
                                <p className="whitespace-pre-wrap break-words">{message.content}</p>
                            </div>
                          ) : null}
                          {attachments.length > 0 ? (
                            <ChatAttachmentList
                              attachments={attachments}
                              tone={ownMessage ? "outgoing" : "incoming"}
                              className={hasContent ? "mt-2" : undefined}
                            />
                          ) : null}
                          {messageTime && (
                            <p
                              className={`mt-1 px-1 text-[11px] ${
                                ownMessage ? "text-right text-white/28" : "text-white/28"
                              }`}
                            >
                              {messageTime}
                              {receiptLabel ? ` · ${receiptLabel}` : ""}
                            </p>
                          )}
                          {!messageTime && receiptLabel ? (
                            <p className="mt-1 px-1 text-[11px] text-right text-white/28">
                              {receiptLabel}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                    })}
                    <div ref={messageEndRef} />
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-white/6 p-3 sm:p-4">
              <form onSubmit={handleSendMessage}>
                <input
                  ref={attachmentInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(event) =>
                    handleAttachmentSelection(Array.from(event.target.files || []))
                  }
                />
                {pendingAttachments.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {pendingAttachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="group relative overflow-hidden rounded-[22px] border border-white/8 bg-[#101010]"
                      >
                        {attachment.previewUrl ? (
                          <div className="h-24 w-24">
                            <img
                              src={attachment.previewUrl}
                              alt={attachment.file.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="flex h-24 w-52 items-center gap-3 px-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/6 text-white/70">
                              <FileText className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm text-white">{attachment.file.name}</p>
                              <p className="text-xs text-white/45">
                                {formatChatAttachmentSize(attachment.file.size) || "File"}
                              </p>
                            </div>
                          </div>
                        )}
                        <button
                          type="button"
                          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition group-hover:opacity-100"
                          onClick={() => removePendingAttachment(attachment.id)}
                          aria-label={`Remove ${attachment.file.name}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-3 rounded-[26px] border border-white/8 bg-[#111111] p-2 pl-4 shadow-[0_12px_30px_rgba(0,0,0,0.26)]">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0 rounded-full border border-white/8 bg-white/[0.03] text-white hover:bg-white/10"
                    disabled={!activeChatId || sending}
                    onClick={() => attachmentInputRef.current?.click()}
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Input
                    className="min-h-[44px] flex-1 border-0 bg-transparent px-0 py-2 text-sm text-white placeholder:text-white/25 focus-visible:ring-0"
                    placeholder={
                      activeChatId
                        ? "Message, add a file, or Ctrl+V an image"
                        : "Select a conversation first"
                    }
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onPaste={handleComposerPaste}
                    disabled={!activeChatId || sending}
                  />
                  <Button
                    type="submit"
                    disabled={!activeChatId || sending || (!messageInput.trim() && pendingAttachments.length === 0)}
                    className="h-10 w-10 rounded-full bg-white p-0 text-black hover:bg-white/90"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </form>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
