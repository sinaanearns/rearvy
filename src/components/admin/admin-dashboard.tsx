"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  Building2,
  Check,
  ChevronRight,
  Loader2,
  LogOut,
  MessageSquare,
  Pencil,
  Search,
  Settings,
  Sparkles,
  Trash2,
  TrendingUp,
  Send,
  Users,
  Paperclip,
  X,
  Zap,
  FileText,
  Eye,
  ShieldAlert,
  History,
  Mail,
  Globe,
  Database,
  Calendar,
} from "lucide-react";

import { ChatAttachmentList } from "@/components/chat/chat-attachment-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type ChatAttachment,
  MAX_CHAT_ATTACHMENTS_PER_MESSAGE,
  MAX_CHAT_ATTACHMENT_SIZE_BYTES,
  formatChatAttachmentSize,
  isImageContentType,
} from "@/lib/chat/attachments";

const BUSINESS_STATUSES = [
  { value: "active", label: "Active" },
  { value: "approved", label: "Approved" },
  { value: "ideation", label: "Ideation" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
] as const;

const BUSINESS_STAGES = [
  { value: "building", label: "Building" },
  { value: "formation", label: "Formation" },
  { value: "scaling", label: "Scaling" },
  { value: "exiting", label: "Exiting" },
] as const;

const BUSINESS_CATEGORIES = [
  { value: "tech", label: "Tech/Software" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "saas", label: "SaaS" },
  { value: "content", label: "Content/Creator" },
  { value: "other", label: "Other" },
] as const;

type AdminActivity = {
  id: string;
  source: string;
  title: string;
  detail: string;
  status: string;
  timestamp: string;
};

type AdminBusiness = {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  status: string;
  stage: string;
  member_count: number;
  founder_id: string | null;
  created_at: string;
};

type AdminUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  disabled: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  username?: string | null;
  fullName?: string | null;
  existingChatId?: string | null;
};

type AdminStats = {
  totalUsers: number;
  activeChats: number;
  revenue: number;
  currency: string;
  latency: string;
  websiteEventCount: number;
  latestActivityAgeMinutes: number | null;
};

type AdminStatsResponse = {
  adminEmail: string | null;
  adminUid: string | null;
  stats: AdminStats;
  recentActivities: AdminActivity[];
  recentBusinesses: AdminBusiness[];
  users: AdminUser[];
};

type AdminJoinRequest = {
  id: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  message: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  decision_note: string | null;
};

type AdminChatMessage = {
  id: string;
  chat_id: string;
  sender_id: string | null;
  content: string | null;
  created_at: unknown;
  attachments?: ChatAttachment[];
};

type PendingAttachment = {
  id: string;
  file: File;
  previewUrl: string | null;
};

function toTimestamp(value: unknown): number {
  if (value && typeof value === "object") {
    const timestampValue = value as {
      toDate?: () => Date;
      _seconds?: unknown;
      _nanoseconds?: unknown;
      seconds?: unknown;
      nanoseconds?: unknown;
    };

    if (typeof timestampValue.toDate === "function") {
      try {
        const date = timestampValue.toDate();
        const time = date instanceof Date ? date.getTime() : Number.NaN;
        if (Number.isFinite(time)) {
          return time;
        }
      } catch {
        // Ignore invalid timestamp objects and continue below.
      }
    }

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

type CreateBusinessForm = {
  name: string;
  description: string;
  category: string;
  status: string;
  stage: string;
};

type EditBusinessForm = {
  name: string;
  description: string;
  category: string;
  status: string;
  stage: string;
};

export default function AdminDashboardClient() {
  const [data, setData] = useState<AdminStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState<
    "Overview" | "Users" | "Chats" | "Analytics" | "Join Requests" | "Settings"
  >("Overview");
  const [createForm, setCreateForm] = useState<CreateBusinessForm>({
    name: "",
    description: "",
    category: "tech",
    status: "active",
    stage: "building",
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminBusiness | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<AdminBusiness | null>(null);
  const [editForm, setEditForm] = useState<EditBusinessForm>({
    name: "",
    description: "",
    category: "tech",
    status: "active",
    stage: "building",
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [chatSearch, setChatSearch] = useState("");
  const [chatUsers, setChatUsers] = useState<AdminUser[]>([]);
  const [chatUsersLoaded, setChatUsersLoaded] = useState(false);
  const [selectedChatUserId, setSelectedChatUserId] = useState<string | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<AdminChatMessage[]>([]);
  const [chatOtherParticipantLastReadAt, setChatOtherParticipantLastReadAt] = useState<number | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatPendingAttachments, setChatPendingAttachments] = useState<PendingAttachment[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [joinRequests, setJoinRequests] = useState<AdminJoinRequest[]>([]);
  const [joinRequestsLoading, setJoinRequestsLoading] = useState(false);
  const [joinRequestsError, setJoinRequestsError] = useState<string | null>(null);
  const [joinActionLoadingId, setJoinActionLoadingId] = useState<string | null>(null);
  const [joinActionError, setJoinActionError] = useState<string | null>(null);
  const router = useRouter();
  const didAutoOpenRearvyChatRef = useRef(false);
  const adminAttachmentInputRef = useRef<HTMLInputElement | null>(null);
  const adminChatScrollRef = useRef<HTMLDivElement | null>(null);
  const chatPendingAttachmentsRef = useRef<PendingAttachment[]>([]);
  const [viewingUser, setViewingUser] = useState<AdminUser | null>(null);
  const [viewingUserData, setViewingUserData] = useState<any | null>(null);
  const [viewingUserLoading, setViewingUserLoading] = useState(false);
  const [viewingUserError, setViewingUserError] = useState<string | null>(null);

  const scrollAdminChatToBottom = useCallback(() => {
    window.requestAnimationFrame(() => {
      const container = adminChatScrollRef.current;
      if (!container) {
        return;
      }

      container.scrollTop = container.scrollHeight;
    });
  }, []);

  const fetchUserData = useCallback(async (uid: string) => {
    try {
      setViewingUserLoading(true);
      setViewingUserError(null);
      const response = await fetch(`/api/admin/users/${uid}/data`);
      
      if (response.status === 401) {
        router.push("/admin/login");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load user data");
      }

      const payload = await response.json();
      setViewingUserData(payload);
    } catch (error) {
      console.error("Failed to load user data", error);
      setViewingUserError(error instanceof Error ? error.message : "Failed to load user data");
    } finally {
      setViewingUserLoading(false);
    }
  }, [router]);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/stats");

      if (response.status === 401) {
        router.push("/admin/login");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load admin data");
      }

      const payload = (await response.json()) as AdminStatsResponse;
      setData(payload);
    } catch (error) {
      console.error("Failed to load stats", error);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  const loadChatUsers = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/chats/users");

      if (response.status === 401) {
        router.push("/admin/login");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load chat users");
      }

      const payload = (await response.json()) as { users?: AdminUser[] };
      setChatUsers(Array.isArray(payload.users) ? payload.users : []);
    } catch (error) {
      console.error("Failed to load chat users", error);
      setChatUsers([]);
    } finally {
      setChatUsersLoaded(true);
    }
  }, [router]);

  useEffect(() => {
    if (currentTab !== "Chats" || chatUsersLoaded) {
      return;
    }

    void loadChatUsers();
  }, [chatUsersLoaded, currentTab, loadChatUsers]);

  const loadJoinRequests = useCallback(async () => {
    try {
      setJoinRequestsLoading(true);
      setJoinRequestsError(null);

      const response = await fetch("/api/admin/businesses/join-requests?status=submitted&limit=100");
      if (response.status === 401) {
        router.push("/admin/login");
        return;
      }

      const payload = (await response.json()) as { error?: string; requests?: AdminJoinRequest[] };

      if (!response.ok) {
        throw new Error(payload.error || "Failed to load join requests");
      }

      setJoinRequests(Array.isArray(payload.requests) ? payload.requests : []);
    } catch (error) {
      setJoinRequestsError(error instanceof Error ? error.message : "Failed to load join requests");
      setJoinRequests([]);
    } finally {
      setJoinRequestsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (currentTab !== "Join Requests") {
      return;
    }

    void loadJoinRequests();
  }, [currentTab, loadJoinRequests]);

  async function handleCreateBusiness(event: React.FormEvent) {
    event.preventDefault();
    setCreateError(null);
    setCreateMessage(null);
    setCreateLoading(true);

    try {
      const response = await fetch("/api/admin/businesses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createForm),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Failed to create business");
      }

      setCreateMessage(payload.message || "Business created successfully.");
      setCreateForm({
        name: "",
        description: "",
        category: "tech",
        status: "active",
        stage: "building",
      });
      await fetchStats();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to create business");
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleDeleteBusiness() {
    if (!deleteTarget) {
      return;
    }

    try {
      setDeleteLoading(true);
      setDeleteError(null);

      const response = await fetch(`/api/admin/businesses/${deleteTarget.id}`, {
        method: "DELETE",
      });

      const payload = (await response.json()) as { error?: string };

      if (response.status === 401) {
        router.push("/admin/login");
        return;
      }

      if (!response.ok) {
        throw new Error(payload.error || "Failed to delete business");
      }

      setDeleteTarget(null);
      await fetchStats();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Failed to delete business");
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleEditBusiness(event: React.FormEvent) {
    event.preventDefault();

    if (!editTarget) {
      return;
    }

    try {
      setEditLoading(true);
      setEditError(null);

      const response = await fetch("/api/admin/businesses", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId: editTarget.id,
          name: editForm.name,
          description: editForm.description,
          category: editForm.category,
          status: editForm.status,
          stage: editForm.stage,
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (response.status === 401) {
        router.push("/admin/login");
        return;
      }

      if (!response.ok) {
        throw new Error(payload.error || "Failed to update business");
      }

      setEditTarget(null);
      await fetchStats();
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Failed to update business");
    } finally {
      setEditLoading(false);
    }
  }

  const chatRosterUsers = chatUsers.length > 0 ? chatUsers : data?.users || [];

  const filteredChatUsers = useMemo(() => {
    if (!chatRosterUsers) {
      return [];
    }

    const query = chatSearch.trim().toLowerCase();
    if (!query) {
      return chatRosterUsers;
    }

    return chatRosterUsers.filter((user) => {
      const haystack = [
        user.displayName,
        user.email,
        user.uid,
        user.username,
        user.fullName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [chatRosterUsers, chatSearch]);

  const selectedChatUser = useMemo(() => {
    if (!chatRosterUsers || !selectedChatUserId) {
      return null;
    }

    return chatRosterUsers.find((user) => user.uid === selectedChatUserId) || null;
  }, [chatRosterUsers, selectedChatUserId]);
  const latestAdminMessageId = useMemo(() => {
    const adminUid = data?.adminUid || null;
    if (!adminUid) {
      return null;
    }

    for (let index = chatMessages.length - 1; index >= 0; index -= 1) {
      if (chatMessages[index]?.sender_id === adminUid) {
        return chatMessages[index].id;
      }
    }

    return null;
  }, [chatMessages, data?.adminUid]);

  const revokeChatAttachmentPreviews = useCallback((attachments: PendingAttachment[]) => {
    attachments.forEach((attachment) => {
      if (attachment.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
      }
    });
  }, []);

  const appendChatAttachments = useCallback((files: File[]) => {
    if (files.length === 0) {
      return;
    }

    setChatPendingAttachments((current) => {
      const slotsLeft = Math.max(MAX_CHAT_ATTACHMENTS_PER_MESSAGE - current.length, 0);
      if (slotsLeft === 0) {
        setChatError(`You can send up to ${MAX_CHAT_ATTACHMENTS_PER_MESSAGE} attachments at once.`);
        return current;
      }

      const acceptedFiles: File[] = [];
      for (const file of files) {
        if (acceptedFiles.length >= slotsLeft) {
          break;
        }

        if (file.size > MAX_CHAT_ATTACHMENT_SIZE_BYTES) {
          setChatError(`"${file.name}" is larger than 15MB.`);
          continue;
        }

        acceptedFiles.push(file);
      }

      if (acceptedFiles.length === 0) {
        return current;
      }

      setChatError(null);
      return [...current, ...acceptedFiles.map((file) => createPendingAttachment(file))];
    });
  }, []);

  const removeChatAttachment = useCallback((attachmentId: string) => {
    setChatPendingAttachments((current) => {
      const attachment = current.find((item) => item.id === attachmentId);
      if (attachment?.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
      }

      return current.filter((item) => item.id !== attachmentId);
    });
  }, []);

  async function uploadAdminChatAttachment(chatId: string, file: File) {
    const formData = new FormData();
    formData.set("chatId", chatId);
    formData.set("file", file);

    const response = await fetch("/api/admin/chats/attachments", {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      attachment?: ChatAttachment;
    };

    if (response.status === 401) {
      router.push("/admin/login");
      throw new Error("Unauthorized");
    }

    if (!response.ok || !payload.attachment) {
      throw new Error(payload.error || "Failed to upload attachment");
    }

    return payload.attachment;
  }

  useEffect(() => {
    chatPendingAttachmentsRef.current = chatPendingAttachments;
  }, [chatPendingAttachments]);

  useEffect(() => {
    return () => {
      revokeChatAttachmentPreviews(chatPendingAttachmentsRef.current);
    };
  }, [revokeChatAttachmentPreviews]);

  useEffect(() => {
    if (
      currentTab !== "Chats" ||
      !chatUsersLoaded ||
      selectedChatId ||
      chatLoading ||
      didAutoOpenRearvyChatRef.current
    ) {
      return;
    }

    const rearvyUser = chatRosterUsers.find((user) => {
      const haystack = [
        user.displayName,
        user.email,
        user.uid,
        user.username,
        user.fullName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes("rearvy");
    });

    if (!rearvyUser) {
      return;
    }

    didAutoOpenRearvyChatRef.current = true;
    void openAdminChat(rearvyUser);
  }, [chatLoading, chatRosterUsers, chatUsersLoaded, currentTab, openAdminChat, selectedChatId]);

  const loadAdminChat = useCallback(async (chatId: string) => {
    try {
      setChatLoading(true);
      setChatError(null);

      const response = await fetch(`/api/admin/chats/${chatId}/messages`);
      if (response.status === 401) {
        router.push("/admin/login");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load chat messages");
      }

      const payload = (await response.json()) as {
        messages?: AdminChatMessage[];
        otherParticipantLastReadAt?: number;
      };
      setChatMessages(Array.isArray(payload.messages) ? payload.messages : []);
      setChatOtherParticipantLastReadAt(
        typeof payload.otherParticipantLastReadAt === "number"
          ? payload.otherParticipantLastReadAt
          : null
      );
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Failed to load chat messages");
      setChatMessages([]);
      setChatOtherParticipantLastReadAt(null);
    } finally {
      setChatLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (currentTab !== "Chats" || !selectedChatId) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadAdminChat(selectedChatId);
    }, 8000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [currentTab, loadAdminChat, selectedChatId]);

  async function openAdminChat(user: AdminUser) {
    try {
      setChatError(null);
      setSelectedChatUserId(user.uid);

      const response = await fetch("/api/admin/chats/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: user.uid }),
      });

      const payload = (await response.json()) as { error?: string; chatId?: string };
      if (!response.ok || !payload.chatId) {
        throw new Error(payload.error || "Failed to open chat");
      }

      setSelectedChatId(payload.chatId);
      revokeChatAttachmentPreviews(chatPendingAttachmentsRef.current);
      setChatPendingAttachments([]);
      await loadAdminChat(payload.chatId);
      scrollAdminChatToBottom();
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Failed to open chat");
    }
  }

  function handleAdminAttachmentSelection(files: File[]) {
    appendChatAttachments(files);
    if (adminAttachmentInputRef.current) {
      adminAttachmentInputRef.current.value = "";
    }
  }

  function handleAdminChatPaste(event: React.ClipboardEvent<HTMLInputElement>) {
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
    appendChatAttachments(imageFiles);
  }

  async function handleSendAdminChatMessage(event: React.FormEvent) {
    event.preventDefault();

    if (!selectedChatId) {
      return;
    }

    const content = chatInput.trim();
    if (!content && chatPendingAttachments.length === 0) {
      return;
    }

    try {
      setChatSending(true);
      setChatError(null);
      const uploadedAttachments =
        chatPendingAttachments.length > 0
          ? await Promise.all(
              chatPendingAttachments.map((attachment) =>
                uploadAdminChatAttachment(selectedChatId, attachment.file)
              )
            )
          : [];

      const response = await fetch(`/api/admin/chats/${selectedChatId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content, attachments: uploadedAttachments }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to send message");
      }

      revokeChatAttachmentPreviews(chatPendingAttachments);
      setChatPendingAttachments([]);
      setChatInput("");
      await loadAdminChat(selectedChatId);
      scrollAdminChatToBottom();
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Failed to send message");
    } finally {
      setChatSending(false);
    }
  }

  async function handleJoinRequestDecision(requestId: string, action: "approve" | "decline") {
    try {
      setJoinActionLoadingId(requestId);
      setJoinActionError(null);

      const response = await fetch(`/api/admin/businesses/join-requests/${requestId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      const payload = (await response.json()) as { error?: string };

      if (response.status === 401) {
        router.push("/admin/login");
        return;
      }

      if (!response.ok) {
        throw new Error(payload.error || "Failed to update join request");
      }

      await Promise.all([loadJoinRequests(), fetchStats()]);
    } catch (error) {
      setJoinActionError(
        error instanceof Error ? error.message : "Failed to update join request"
      );
    } finally {
      setJoinActionLoadingId(null);
    }
  }

  async function handleAdminLogout() {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } finally {
      // Try to sign out client-side firebase auth if present, but ignore errors
      try {
        const mod = await import("@/lib/firebase/auth");
        if (typeof mod.signOut === "function") {
          await mod.signOut();
        }
      } catch (e) {
        // ignore
      }

      router.push("/admin/login");
    }
  }

  const adminEmail = data?.adminEmail || "Admin";
  const adminInitials = getInitials(adminEmail);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background overflow-hidden selection:bg-slate-500/30">
      <aside className="hidden w-72 flex-col border-r border-border/50 bg-card/30 backdrop-blur-md md:flex">
        <div className="p-6">
          <div className="mb-8 flex items-center gap-3">
            <Image
              src="/rearvy-wordmark.svg"
              alt="Rearvy"
              width={120}
              height={28}
              className="h-7 w-auto dark:invert"
            />
            <span className="rounded border border-slate-500/20 bg-slate-500/10 px-1.5 py-0.5 text-[10px] font-bold text-slate-400">
              ADMIN
            </span>
          </div>

          <nav className="space-y-1.5">
            <NavItem
              icon={<BarChart3 size={18} />}
              label="Overview"
              active={currentTab === "Overview"}
              onClick={() => setCurrentTab("Overview")}
            />
            <NavItem
              icon={<Users size={18} />}
              label="Users"
              active={currentTab === "Users"}
              onClick={() => setCurrentTab("Users")}
            />
            <NavItem
              icon={<MessageSquare size={18} />}
              label="Chats"
              active={currentTab === "Chats"}
              onClick={() => setCurrentTab("Chats")}
            />
            <NavItem
              icon={<Bell size={18} />}
              label="Join Requests"
              active={currentTab === "Join Requests"}
              onClick={() => setCurrentTab("Join Requests")}
            />
            <NavItem
              icon={<BarChart3 size={18} />}
              label="Analytics"
              active={currentTab === "Analytics"}
              onClick={() => setCurrentTab("Analytics")}
            />
            <div className="mt-4 border-t border-border/50 pt-4">
              <NavItem
                icon={<Settings size={18} />}
                label="Settings"
                active={currentTab === "Settings"}
                onClick={() => setCurrentTab("Settings")}
              />
              <NavItem
                icon={<LogOut size={18} />}
                label="Logout"
                danger
                onClick={() => void handleAdminLogout()}
              />
            </div>
          </nav>
        </div>

        <div className="mt-auto p-4">
          <Card className="border-slate-700/30 bg-gradient-to-br from-slate-800 to-slate-950 text-white">
            <CardContent className="p-4">
              <div className="mb-2 flex items-center gap-2">
                <Zap size={14} className="text-slate-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-white">
                  Live Admin Data
                </span>
              </div>
              <div className="space-y-1 text-sm text-slate-300">
                <p>{data?.stats.websiteEventCount || 0} tracked events</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </aside>

      <main className="relative flex-1 overflow-y-auto">
        <div className="absolute inset-x-0 top-0 -z-10 h-64 bg-gradient-to-b from-slate-600/5 via-slate-700/5 to-transparent" />

        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border/50 bg-background/60 px-4 backdrop-blur md:px-8">
          <div className="flex w-full max-w-xl items-center gap-3 rounded-full border border-border/40 bg-muted/30 px-4 py-2 transition-all focus-within:border-slate-500/40">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search live admin data..."
              className="w-full border-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="flex items-center gap-3 md:gap-4">
            <button className="relative rounded-xl border border-transparent p-2 transition-colors hover:border-border/50 hover:bg-muted/50">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full border-2 border-background bg-slate-500" />
            </button>
            <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/30 px-3 py-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 text-[10px] font-bold uppercase text-white">
                {adminInitials}
              </div>
              <div className="hidden text-left sm:block">
                <p className="text-xs font-medium text-muted-foreground">Signed in</p>
                <p className="text-sm font-semibold text-foreground">{adminEmail}</p>
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl space-y-10 p-4 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-500/20 bg-slate-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                {currentTab}
              </div>
              <h1 className="flex items-center gap-3 text-4xl font-bold tracking-tight text-foreground">
                {currentTab === "Overview" ? "Admin Panel" : currentTab}
              </h1>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-slate-500/10 bg-slate-500/5 px-4 py-2 text-sm font-medium text-slate-400">
              <div className="h-2 w-2 rounded-full bg-slate-500 animate-pulse" />
              Session Active: {adminEmail}
            </div>
          </div>

          {currentTab === "Overview" && data && (
            <>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
                <StatsCard
                  title="Total Users"
                  value={data.stats.totalUsers.toString()}
                  change="Live"
                  icon={<Users className="text-slate-400" />}
                />
                <StatsCard
                  title="Active Chats"
                  value={data.stats.activeChats.toString()}
                  change="Live"
                  icon={<MessageSquare className="text-slate-400" />}
                />
                <StatsCard
                  title="Revenue"
                  value={`${data.stats.currency === "INR" ? "₹" : "$"}${data.stats.revenue.toLocaleString()}`}
                  change="Verified"
                  icon={<TrendingUp className="text-slate-400" />}
                />
                <StatsCard
                  title="Tracked Events"
                  value={data.stats.websiteEventCount.toString()}
                  change={data.stats.latency}
                  icon={<Zap className="text-slate-400" />}
                />
              </div>

              <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
                <section className="space-y-4 xl:col-span-2">
                  <Card className="border-border/50 bg-card/40 backdrop-blur transition-all hover:bg-card/60">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                      <div>
                        <CardTitle className="text-xl">Critical Activities</CardTitle>
                        <CardDescription>
                          Recent website, idea, and business activity from Firestore.
                        </CardDescription>
                      </div>
                      <button className="flex items-center gap-1 text-sm font-medium text-slate-400 transition-colors hover:text-foreground">
                        View source data <ChevronRight size={14} />
                      </button>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {data.recentActivities.length > 0 ? (
                          data.recentActivities.map((activity) => (
                            <ActivityItem
                              key={activity.id}
                              user={activity.title}
                              action={activity.detail}
                              time={formatTimestamp(activity.timestamp)}
                              status={activity.status}
                            />
                          ))
                        ) : (
                          <p className="py-6 text-sm text-muted-foreground">
                            No live activity has been recorded yet.
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </section>

                <section className="space-y-4">
                  <Card className="border-slate-700/30 bg-gradient-to-br from-slate-800/20 to-card/50 backdrop-blur">
                    <CardHeader>
                      <CardTitle className="text-xl">Live Platform Data</CardTitle>
                      <CardDescription>
                        Actual counters and timestamps from the backend.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <StatusRow label="Event stream" value={data.stats.websiteEventCount.toString()} />
                      <StatusRow
                        label="Last activity"
                        value={
                          data.stats.latestActivityAgeMinutes === null
                            ? "No events yet"
                            : `${data.stats.latestActivityAgeMinutes}m ago`
                        }
                      />
                    </CardContent>
                  </Card>

                  <Card className="border-border/50 bg-card/40 backdrop-blur">
                    <CardHeader>
                      <CardTitle className="text-xl">Recent Businesses</CardTitle>
                      <CardDescription>
                        The latest Rearvy businesses stored in Firestore.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {data.recentBusinesses.length > 0 ? (
                        data.recentBusinesses.map((business) => (
                          <div
                            key={business.id}
                            className="rounded-2xl border border-border/50 bg-background/50 p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-foreground">{business.name}</p>
                                <p className="text-sm text-muted-foreground capitalize">
                                  {business.category} • {business.stage}
                                </p>
                              </div>
                              <span className="rounded-full border border-slate-500/20 bg-slate-500/5 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                {business.status}
                              </span>
                            </div>
                            <p className="mt-3 text-xs text-muted-foreground">
                              {business.member_count} members • {formatTimestamp(business.created_at)}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No businesses have been created yet.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </section>
              </div>
            </>
          )}

          {false && data !== null && (
            <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
              <Card className="border-border/50 bg-card/40 backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-2xl">Create Rearvy Business</CardTitle>
                  <CardDescription>
                    Admins can publish a real business directly into the platform system.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="space-y-5" onSubmit={handleCreateBusiness}>
                    <div className="space-y-2">
                      <Label htmlFor="business-name">Business Name</Label>
                      <Input
                        id="business-name"
                        value={createForm.name}
                        onChange={(event) =>
                          setCreateForm((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                        placeholder="e.g. Rearvy Ops Studio"
                        required
                        minLength={3}
                        maxLength={100}
                      />
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select
                          value={createForm.category}
                          onValueChange={(value) =>
                            setCreateForm((current) => ({ ...current, category: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {BUSINESS_CATEGORIES.map((category) => (
                              <SelectItem key={category.value} value={category.value}>
                                {category.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Select
                          value={createForm.status}
                          onValueChange={(value) =>
                            setCreateForm((current) => ({ ...current, status: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {BUSINESS_STATUSES.map((status) => (
                              <SelectItem key={status.value} value={status.value}>
                                {status.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Stage</Label>
                      <Select
                        value={createForm.stage}
                        onValueChange={(value) =>
                          setCreateForm((current) => ({ ...current, stage: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BUSINESS_STAGES.map((stage) => (
                            <SelectItem key={stage.value} value={stage.value}>
                              {stage.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="business-description">Description</Label>
                      <Textarea
                        id="business-description"
                        value={createForm.description}
                        onChange={(event) =>
                          setCreateForm((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                        placeholder="Describe the business, target customer, and execution goal."
                        rows={5}
                        maxLength={500}
                      />
                    </div>

                    {createError && (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                        {createError}
                      </div>
                    )}

                    {createMessage && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                        {createMessage}
                      </div>
                    )}

                    <Button type="submit" disabled={createLoading} className="w-full">
                      {createLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Building2 className="mr-2 h-4 w-4" />
                      )}
                      Create Business
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/40 backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-2xl">Published Businesses</CardTitle>
                  <CardDescription>
                    Actual business records created by admin users.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Businesses feature has been disabled.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          <Dialog
            open={Boolean(editTarget)}
            onOpenChange={(open) => {
              if (!open && !editLoading) {
                setEditTarget(null);
                setEditError(null);
              }
            }}
          >
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Edit business</DialogTitle>
                <DialogDescription>
                  Update details for {editTarget?.name || "this business"}.
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={handleEditBusiness}>
                <div className="space-y-2">
                  <Label htmlFor="edit-business-name">Business Name</Label>
                  <Input
                    id="edit-business-name"
                    value={editForm.name}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    required
                    minLength={3}
                    maxLength={100}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select
                      value={editForm.category}
                      onValueChange={(value) =>
                        setEditForm((current) => ({ ...current, category: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BUSINESS_CATEGORIES.map((category) => (
                          <SelectItem key={category.value} value={category.value}>
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={editForm.status}
                      onValueChange={(value) =>
                        setEditForm((current) => ({ ...current, status: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BUSINESS_STATUSES.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Stage</Label>
                  <Select
                    value={editForm.stage}
                    onValueChange={(value) =>
                      setEditForm((current) => ({ ...current, stage: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BUSINESS_STAGES.map((stage) => (
                        <SelectItem key={stage.value} value={stage.value}>
                          {stage.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-business-description">Description</Label>
                  <Textarea
                    id="edit-business-description"
                    value={editForm.description}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    rows={4}
                    maxLength={500}
                  />
                </div>

                {editError && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400">
                    {editError}
                  </div>
                )}

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditTarget(null);
                      setEditError(null);
                    }}
                    disabled={editLoading}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={editLoading}>
                    {editLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Save changes
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog
            open={Boolean(deleteTarget)}
            onOpenChange={(open) => {
              if (!open && !deleteLoading) {
                setDeleteTarget(null);
                setDeleteError(null);
              }
            }}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Delete business</DialogTitle>
                <DialogDescription>
                  This permanently removes {deleteTarget?.name || "this business"} and its linked
                  business records.
                </DialogDescription>
              </DialogHeader>
              {deleteError && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400">
                  {deleteError}
                </div>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDeleteTarget(null);
                    setDeleteError(null);
                  }}
                  disabled={deleteLoading}
                >
                  Cancel
                </Button>
                <Button type="button" variant="destructive" onClick={() => void handleDeleteBusiness()} disabled={deleteLoading}>
                  {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Delete business
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {currentTab === "Users" && data && (
            <Card className="border-border/50 bg-card/40 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-2xl">All Users</CardTitle>
                <CardDescription>
                  Real Firebase Auth users connected to Rearvy.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 grid gap-4 sm:grid-cols-3">
                  <StatPill label="Total users" value={data.stats.totalUsers.toString()} />
                  <StatPill label="Active chats" value={data.stats.activeChats.toString()} />
                  <StatPill label="Event stream" value={data.stats.websiteEventCount.toString()} />
                  <StatPill
                    label="Admin email"
                    value={data.adminEmail || "Unknown"}
                    truncate
                  />
                </div>

                {data.users.length > 0 ? (
                  <div className="overflow-hidden rounded-2xl border border-border/50">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-border/50 text-left text-sm">
                        <thead className="bg-muted/40 text-xs uppercase tracking-widest text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3 font-semibold">User</th>
                            <th className="px-4 py-3 font-semibold">Email</th>
                            <th className="px-4 py-3 font-semibold">Status</th>
                            <th className="px-4 py-3 font-semibold">Created</th>
                            <th className="px-4 py-3 font-semibold">Last sign-in</th>
                            <th className="px-4 py-3 font-semibold text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40 bg-background/30">
                          {data.users.map((user) => (
                            <tr key={user.uid} className="align-top transition-colors hover:bg-muted/20">
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 text-xs font-bold uppercase text-white">
                                    {getInitials(user.displayName || user.email || user.uid)}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-foreground">
                                      {user.displayName || "Unnamed user"}
                                    </p>
                                    <p className="max-w-[220px] truncate text-xs text-muted-foreground">
                                      {user.uid}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-muted-foreground">
                                {user.email || "No email"}
                              </td>
                              <td className="px-4 py-4">
                                <span
                                  className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${
                                    user.disabled
                                      ? "border-red-500/20 bg-red-500/5 text-red-400"
                                      : "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
                                  }`}
                                >
                                  {user.disabled ? "Disabled" : "Active"}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-muted-foreground">
                                {formatTimestamp(user.createdAt)}
                              </td>
                              <td className="px-4 py-4 text-muted-foreground">
                                {user.lastSignInAt ? formatTimestamp(user.lastSignInAt) : "Never"}
                              </td>
                              <td className="px-4 py-4 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 hover:bg-slate-500/10"
                                  onClick={() => {
                                    setViewingUser(user);
                                    void fetchUserData(user.uid);
                                  }}
                                >
                                  <Eye className="h-4 w-4 text-slate-400" />
                                  <span className="sr-only">View data</span>
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <DataEmptyState
                    icon={<Users className="h-12 w-12 text-slate-500/50" />}
                    title="No users yet"
                    description="Firebase Auth has not returned any users yet."
                  />
                )}
              </CardContent>
            </Card>
          )}

          {currentTab === "Join Requests" && data && (
            <Card className="border-border/50 bg-card/40 backdrop-blur">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-2xl">Join Requests Queue</CardTitle>
                  <CardDescription>
                    Approve to add the user as an active member, or decline to close the request.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void loadJoinRequests()}
                  disabled={joinRequestsLoading}
                >
                  {joinRequestsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {joinActionError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    {joinActionError}
                  </div>
                )}

                {joinRequestsError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    {joinRequestsError}
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-3">
                  <StatPill label="Pending requests" value={joinRequests.length.toString()} />
                  <StatPill label="Latency" value={data.stats.latency} />
                </div>

                {joinRequestsLoading ? (
                  <div className="flex items-center gap-2 rounded-2xl border border-border/50 bg-background/50 p-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading join requests...
                  </div>
                ) : null}

                {!joinRequestsLoading && joinRequests.length === 0 ? (
                  <div className="rounded-2xl border border-border/50 bg-background/50 p-10 text-center text-sm text-muted-foreground">
                    No pending join requests right now.
                  </div>
                ) : null}

                {!joinRequestsLoading &&
                  joinRequests.map((joinRequest) => {
                    const actingOnThis = joinActionLoadingId === joinRequest.id;

                    return (
                      <div
                        key={joinRequest.id}
                        className="rounded-2xl border border-border/50 bg-background/50 p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-foreground">
                              Join request
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Requested by {joinRequest.user_name || joinRequest.user_email || joinRequest.user_id}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatTimestamp(joinRequest.created_at)}
                            </p>
                          </div>
                          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-500">
                            {joinRequest.status}
                          </span>
                        </div>

                        <p className="mt-3 rounded-xl border border-border/40 bg-muted/30 p-3 text-sm text-muted-foreground">
                          {joinRequest.message || "No message provided."}
                        </p>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void handleJoinRequestDecision(joinRequest.id, "approve")}
                            disabled={actingOnThis}
                          >
                            {actingOnThis ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                            Approve
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => void handleJoinRequestDecision(joinRequest.id, "decline")}
                            disabled={actingOnThis}
                          >
                            {actingOnThis ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <X className="h-4 w-4" />
                            )}
                            Decline
                          </Button>
                        </div>
                      </div>
                    );
                  })}
              </CardContent>
            </Card>
          )}

          {currentTab === "Chats" && data && (
            <div className="grid grid-cols-1 gap-8 xl:grid-cols-[380px_1fr]">
              <Card className="border-border/50 bg-card/40 backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-2xl">Platform Users</CardTitle>
                  <CardDescription>
                    Users active in Rearvy appear here for admin direct messages.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-background/50 px-4 py-3">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      value={chatSearch}
                      onChange={(event) => setChatSearch(event.target.value)}
                      placeholder="Search by name, email, or ID"
                      className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                    />
                  </div>

                  <div className="rounded-2xl border border-border/50 bg-background/30">
                    <div className="max-h-[620px] divide-y divide-border/50 overflow-y-auto">
                      {filteredChatUsers.length > 0 ? (
                        filteredChatUsers.map((user) => {
                          const isActive = selectedChatUserId === user.uid;
                          return (
                            <button
                              key={user.uid}
                              onClick={() => void openAdminChat(user)}
                              className={`flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/20 ${
                                isActive ? "bg-muted/20" : ""
                              }`}
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 text-xs font-bold uppercase text-white">
                                  {getInitials(user.displayName || user.email || user.uid)}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-foreground">
                                    {user.displayName || user.email || "Rearvy user"}
                                  </p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {user.email || user.uid}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right text-[10px] uppercase tracking-widest text-muted-foreground">
                                <p>{user.disabled ? "Disabled" : "Active"}</p>
                                <p>{user.lastSignInAt ? "Recently signed in" : "No sign-in"}</p>
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                          No users match this search.
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/40 backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-2xl">
                    {selectedChatUser ? `Chat with ${selectedChatUser.displayName || selectedChatUser.email || selectedChatUser.uid}` : "Open a user chat"}
                  </CardTitle>
                  <CardDescription>
                    Messages from here appear to members as the official Rearvy Admin thread.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {chatError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                      {chatError}
                    </div>
                  )}

                  {!selectedChatUser && (
                    <div className="rounded-2xl border border-border/50 bg-background/50 p-10 text-center text-sm text-muted-foreground">
                      Select a user from the list to open a direct message.
                    </div>
                  )}

                  {selectedChatUser && (
                    <div className="flex min-h-0 flex-col gap-4">
                      <div className="flex items-center justify-between rounded-2xl border border-border/50 bg-background/50 px-4 py-3 text-sm">
                        <div>
                          <p className="font-semibold text-foreground">
                            {selectedChatUser.displayName || "Rearvy user"}
                          </p>
                          <p className="text-muted-foreground">
                            {selectedChatUser.email || selectedChatUser.uid}
                          </p>
                        </div>
                        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                          Direct message
                        </span>
                      </div>

                      <div className="flex h-[min(68vh,760px)] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-border/50 bg-background/30">
                        <div
                          ref={adminChatScrollRef}
                          className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pr-2"
                        >
                          {chatLoading && (
                            <div className="flex h-full min-h-[320px] items-center justify-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading conversation...
                            </div>
                          )}

                          {!chatLoading && chatMessages.length === 0 && (
                            <div className="flex h-full min-h-[320px] items-center justify-center text-center">
                              <p className="text-sm text-muted-foreground">
                                No messages yet. Send the first message from admin.
                              </p>
                            </div>
                          )}

                          {!chatLoading && chatMessages.length > 0 && (
                            <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-end gap-4">
                              {chatMessages.map((message) => {
                                const fromAdmin = message.sender_id === data.adminUid;
                                const hasContent = Boolean(message.content?.trim());
                                const attachments = message.attachments || [];
                                const latestAdminMessage =
                                  fromAdmin &&
                                  latestAdminMessageId !== null &&
                                  message.id === latestAdminMessageId;
                                const messageSeen =
                                  latestAdminMessage &&
                                  typeof chatOtherParticipantLastReadAt === "number" &&
                                  toTimestamp(message.created_at) <= chatOtherParticipantLastReadAt;
                                const receiptLabel = latestAdminMessage
                                  ? messageSeen
                                    ? "Seen"
                                    : "Sent"
                                  : null;

                                return (
                                  <div
                                    key={message.id}
                                    className={`flex w-full ${
                                      fromAdmin ? "justify-end" : "justify-start"
                                    }`}
                                  >
                                    <div
                                      className={`flex max-w-[min(78%,32rem)] flex-col gap-2 ${
                                        fromAdmin ? "items-end" : "items-start"
                                      }`}
                                    >
                                      {hasContent ? (
                                        <div
                                          className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${
                                            fromAdmin
                                              ? "bg-gradient-to-r from-slate-700 to-slate-800 text-white"
                                              : "bg-muted text-foreground"
                                          }`}
                                        >
                                          <p className="whitespace-pre-wrap break-words">
                                            {message.content || ""}
                                          </p>
                                        </div>
                                      ) : null}
                                      {attachments.length > 0 ? (
                                        <ChatAttachmentList
                                          attachments={attachments}
                                          tone={fromAdmin ? "outgoing" : "incoming"}
                                          className={hasContent ? "mt-2" : undefined}
                                        />
                                      ) : null}
                                      {receiptLabel ? (
                                        <p className="px-1 text-[11px] text-white/40">
                                          {receiptLabel}
                                        </p>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      <form onSubmit={handleSendAdminChatMessage} className="space-y-3">
                        <input
                          ref={adminAttachmentInputRef}
                          type="file"
                          multiple
                          className="hidden"
                          onChange={(event) =>
                            handleAdminAttachmentSelection(Array.from(event.target.files || []))
                          }
                        />
                        {chatPendingAttachments.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {chatPendingAttachments.map((attachment) => (
                              <div
                                key={attachment.id}
                                className="group relative overflow-hidden rounded-2xl border border-border/60 bg-background"
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
                                  <div className="flex h-24 w-56 items-center gap-3 px-3">
                                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                                      <FileText className="h-4 w-4" />
                                    </span>
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-medium text-foreground">
                                        {attachment.file.name}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {formatChatAttachmentSize(attachment.file.size) || "File"}
                                      </p>
                                    </div>
                                  </div>
                                )}
                                <button
                                  type="button"
                                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition group-hover:opacity-100"
                                  onClick={() => removeChatAttachment(attachment.id)}
                                  aria-label={`Remove ${attachment.file.name}`}
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => adminAttachmentInputRef.current?.click()}
                            disabled={chatSending || !selectedChatId}
                          >
                            <Paperclip className="h-4 w-4" />
                          </Button>
                          <Input
                            value={chatInput}
                            onChange={(event) => setChatInput(event.target.value)}
                            onPaste={handleAdminChatPaste}
                            placeholder="Type an admin message, add a file, or Ctrl+V an image..."
                            disabled={chatSending}
                          />
                          <Button
                            type="submit"
                            disabled={
                              chatSending ||
                              !selectedChatId ||
                              (!chatInput.trim() && chatPendingAttachments.length === 0)
                            }
                          >
                            {chatSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          </Button>
                        </div>
                      </form>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {currentTab === "Analytics" && data && (
            <DataEmptyState
              icon={<TrendingUp className="h-12 w-12 text-slate-500/50" />}
              title="Analytics"
              description={`Website events tracked: ${data.stats.websiteEventCount}. Revenue verified: ${data.stats.currency === "INR" ? "₹" : "$"}${data.stats.revenue.toLocaleString()}.`}
            />
          )}

          {currentTab === "Settings" && data && (
            <DataEmptyState
              icon={<Settings className="h-12 w-12 text-slate-500/50" />}
              title="Settings"
              description={`Signed in as ${adminEmail}. Admin session is backed by live cookie auth.`}
            />
          )}

          <Dialog
            open={Boolean(viewingUser)}
            onOpenChange={(open) => {
              if (!open) {
                setViewingUser(null);
                setViewingUserData(null);
                setViewingUserError(null);
              }
            }}
          >
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-border/50 bg-[#0a0a0b]/95 backdrop-blur-2xl shadow-2xl">
              <DialogHeader className="p-6 border-b border-white/5 bg-gradient-to-r from-slate-900/50 to-transparent">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-xl font-bold text-white shadow-xl">
                      {getInitials(viewingUser?.displayName || viewingUser?.email || "U")}
                    </div>
                    <div>
                      <DialogTitle className="text-2xl font-bold tracking-tight text-white">
                        {viewingUser?.displayName || "User Data Explorer"}
                      </DialogTitle>
                      <DialogDescription className="text-slate-400 flex items-center gap-2">
                        <Mail size={12} /> {viewingUser?.email || viewingUser?.uid}
                      </DialogDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400 animate-pulse">
                    <ShieldAlert size={10} /> Silent Admin Mode Active
                  </div>
                </div>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {viewingUserLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-slate-500" />
                    <p className="text-slate-400 font-medium">Decrypting and fetching user payload...</p>
                  </div>
                ) : viewingUserError ? (
                  <div className="p-4 rounded-2xl border border-red-500/20 bg-red-500/5 text-red-400 flex items-center gap-3">
                    <X size={18} /> {viewingUserError}
                  </div>
                ) : viewingUserData ? (
                  <div className="space-y-8">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="p-4 rounded-2xl border border-white/5 bg-white/5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Chats</p>
                        <p className="text-2xl font-bold text-white mt-1">{viewingUserData.chats.length}</p>
                      </div>
                      <div className="p-4 rounded-2xl border border-white/5 bg-white/5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Integrations</p>
                        <p className="text-2xl font-bold text-white mt-1">{viewingUserData.integrations.length}</p>
                      </div>
                      <div className="p-4 rounded-2xl border border-white/5 bg-white/5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Events</p>
                        <p className="text-2xl font-bold text-white mt-1">{viewingUserData.events.length}</p>
                      </div>
                      <div className="p-4 rounded-2xl border border-white/5 bg-white/5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Account Age</p>
                        <p className="text-sm font-bold text-white mt-2">
                          {viewingUser?.createdAt ? new Date(viewingUser.createdAt).toLocaleDateString() : "N/A"}
                        </p>
                      </div>
                    </div>

                    {/* Section: Chats */}
                    <section className="space-y-4">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <MessageSquare size={18} className="text-slate-400" /> Interaction History
                      </h3>
                      {viewingUserData.chats.length > 0 ? (
                        <div className="space-y-4">
                          {viewingUserData.chats.map((chat: any) => (
                            <Card key={chat.id} className="border-white/5 bg-white/[0.02] overflow-hidden">
                              <CardHeader className="py-3 px-4 border-b border-white/5 bg-white/[0.03]">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-white">
                                      {chat.title || "Untitled Conversation"}
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 font-mono">
                                      {chat.id}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-500">
                                    {new Date(chat.created_at).toLocaleString()}
                                  </span>
                                </div>
                              </CardHeader>
                              <CardContent className="p-0">
                                <div className="max-h-[300px] overflow-y-auto p-4 space-y-4 bg-black/20">
                                  {chat.messages && chat.messages.length > 0 ? (
                                    chat.messages.map((msg: any) => (
                                      <div key={msg.id} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                                        <div className={`max-w-[80%] rounded-2xl p-3 text-sm ${
                                          msg.role === "user" 
                                            ? "bg-slate-800 text-white" 
                                            : msg.role === "assistant" 
                                              ? "bg-blue-600/20 text-blue-100 border border-blue-500/20" 
                                              : "bg-slate-900 text-slate-400"
                                        }`}>
                                          <p className="whitespace-pre-wrap">{msg.content}</p>
                                        </div>
                                        <span className="text-[9px] text-slate-600 mt-1 px-2 uppercase tracking-tighter">
                                          {msg.role} • {new Date(msg.created_at).toLocaleTimeString()}
                                        </span>
                                      </div>
                                    ))
                                  ) : (
                                    <p className="text-center text-xs text-slate-600 py-4">No messages recorded for this session.</p>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className="p-8 text-center rounded-2xl border border-dashed border-white/10 text-slate-500 text-sm">
                          No AI or DM interactions found for this user.
                        </div>
                      )}
                    </section>

                    {/* Section: Integrations */}
                    <section className="space-y-4">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Database size={18} className="text-slate-400" /> Linked Integrations
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {viewingUserData.integrations.length > 0 ? (
                          viewingUserData.integrations.map((integration: any) => (
                            <div key={integration.id} className="p-4 rounded-2xl border border-white/5 bg-white/[0.02] flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-bold uppercase">
                                  {integration.provider[0]}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-white capitalize">{integration.provider}</p>
                                  <p className="text-[10px] text-slate-500">{integration.provider_account_name || "Unknown account"}</p>
                                </div>
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                integration.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                              }`}>
                                {integration.status}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="col-span-full p-4 text-center rounded-2xl border border-dashed border-white/10 text-slate-500 text-sm">
                            No integrations connected.
                          </div>
                        )}
                      </div>
                    </section>

                    {/* Section: Web Activity */}
                    <section className="space-y-4">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Globe size={18} className="text-slate-400" /> Website Footprint
                      </h3>
                      <div className="rounded-2xl border border-white/5 bg-white/[0.02] divide-y divide-white/5">
                        {viewingUserData.events.length > 0 ? (
                          viewingUserData.events.map((event: any) => (
                            <div key={event.id} className="p-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                              <div className="flex items-center gap-3">
                                <Globe size={14} className="text-slate-600" />
                                <div>
                                  <p className="text-xs font-bold text-white">{event.event_name || event.event_type}</p>
                                  <p className="text-[10px] text-slate-500 truncate max-w-[300px]">{event.path || "Home"}</p>
                                </div>
                              </div>
                              <span className="text-[10px] text-slate-600 font-mono">
                                {new Date(event.timestamp).toLocaleString()}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="p-8 text-center text-slate-500 text-sm">
                            No website events tracked for this UID.
                          </div>
                        )}
                      </div>
                    </section>
                  </div>
                ) : null}
              </div>
              <DialogFooter className="p-4 border-t border-white/5 bg-[#0a0a0b]">
                <Button variant="outline" onClick={() => setViewingUser(null)} className="border-white/10 hover:bg-white/5 text-slate-400">
                  Close Explorer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  );
}

function NavItem({
  icon,
  label,
  active = false,
  danger = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all group ${
        active
          ? "bg-gradient-to-r from-slate-700 to-slate-800 text-white shadow-lg shadow-slate-900/20"
          : danger
            ? "text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      }`}
    >
      <span
        className={active ? "text-white" : "text-muted-foreground group-hover:text-foreground transition-colors"}
      >
        {icon}
      </span>
      <span>{label}</span>
      {active && <div className="ml-auto h-1 w-1 rounded-full bg-white" />}
    </button>
  );
}

function StatsCard({
  title,
  value,
  change,
  icon,
}: {
  title: string;
  value: string;
  change: string;
  icon: React.ReactNode;
}) {
  const isPositive = change === "Live" || change === "Verified";

  return (
    <Card className="group border-border/50 bg-card/40 backdrop-blur transition-all hover:border-slate-500/30 hover:bg-card/60">
      <CardContent className="p-6">
        <div className="mb-5 flex items-center justify-between">
          <div className="rounded-xl border border-border/50 bg-muted/50 p-2.5 text-foreground transition-all group-hover:scale-110 group-hover:bg-slate-700 group-hover:text-white group-hover:shadow-lg group-hover:shadow-slate-900/10">
            {icon}
          </div>
          <span
            className={`rounded-full border px-2 py-1 text-[10px] font-bold ${
              isPositive
                ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
                : "border-slate-500/20 bg-slate-500/5 text-slate-400"
            }`}
          >
            {change}
          </span>
        </div>
        <h3 className="mb-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {title}
        </h3>
        <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function ActivityItem({
  user,
  action,
  time,
  status,
}: {
  user: string;
  action: string;
  time: string;
  status: string;
}) {
  return (
    <div className="flex items-center gap-5 rounded-2xl border-b border-border/30 px-2 py-4 transition-all last:border-0 hover:bg-muted/10">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 text-sm font-bold text-white shadow-inner">
        {getInitials(user)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {user} <span className="ml-1 font-normal text-muted-foreground">{action}</span>
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{time}</p>
      </div>
      <span className="shrink-0 rounded-lg border border-border/50 bg-muted px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {status}
      </span>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/10 py-1 text-xs last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold text-emerald-400">{value}</span>
    </div>
  );
}

function StatPill({
  label,
  value,
  truncate = false,
}: {
  label: string;
  value: string;
  truncate?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-background/50 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 font-semibold text-foreground ${truncate ? "truncate" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function DataEmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="border-border/50 bg-card/40 backdrop-blur">
      <CardContent className="py-20 text-center">
        <div className="mb-4 flex justify-center">{icon}</div>
        <h3 className="text-xl font-bold text-foreground">{title}</h3>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function getInitials(value: string) {
  const parts = value.replace(/[^a-zA-Z0-9 ]/g, "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "AR";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("")
    .slice(0, 2);
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
