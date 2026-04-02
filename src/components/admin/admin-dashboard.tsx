"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  Building2,
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
  Zap,
} from "lucide-react";

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
  societyIdeasCount: number;
  totalSocieties: number;
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

type AdminChatMessage = {
  id: string;
  chat_id: string;
  sender_id: string | null;
  content: string | null;
  created_at: unknown;
};

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
    "Overview" | "Users" | "Chats" | "Analytics" | "Businesses" | "Settings"
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
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const router = useRouter();
  const didAutoOpenRearvyChatRef = useRef(false);

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

  async function handleCreateBusiness(event: React.FormEvent) {
    event.preventDefault();
    setCreateError(null);
    setCreateMessage(null);
    setCreateLoading(true);

    try {
      const response = await fetch("/api/admin/societies", {
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

      const response = await fetch(`/api/admin/societies/${deleteTarget.id}`, {
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

      const response = await fetch("/api/admin/societies", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          societyId: editTarget.id,
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

  async function loadAdminChat(chatId: string) {
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

      const payload = (await response.json()) as { messages?: AdminChatMessage[] };
      setChatMessages(Array.isArray(payload.messages) ? payload.messages : []);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Failed to load chat messages");
      setChatMessages([]);
    } finally {
      setChatLoading(false);
    }
  }

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
      await loadAdminChat(payload.chatId);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Failed to open chat");
    }
  }

  async function handleSendAdminChatMessage(event: React.FormEvent) {
    event.preventDefault();

    if (!selectedChatId) {
      return;
    }

    const content = chatInput.trim();
    if (!content) {
      return;
    }

    try {
      setChatSending(true);
      setChatError(null);

      const response = await fetch(`/api/admin/chats/${selectedChatId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to send message");
      }

      setChatInput("");
      await loadAdminChat(selectedChatId);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Failed to send message");
    } finally {
      setChatSending(false);
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
              icon={<Sparkles size={18} />}
              label="Businesses"
              active={currentTab === "Businesses"}
              onClick={() => setCurrentTab("Businesses")}
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
                onClick={() => router.push("/admin/login")}
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
                <p>{data?.stats.totalSocieties || 0} businesses</p>
                <p>{data?.stats.societyIdeasCount || 0} ideas</p>
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
                      <StatusRow label="Businesses" value={data.stats.totalSocieties.toString()} />
                      <StatusRow label="Ideas in queue" value={data.stats.societyIdeasCount.toString()} />
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
                        The latest Rearvy Societies stored in Firestore.
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

          {currentTab === "Businesses" && data && (
            <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
              <Card className="border-border/50 bg-card/40 backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-2xl">Create Rearvy Society</CardTitle>
                  <CardDescription>
                    Admins can publish a real business directly into the Societies system.
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
                    Actual society records created by admin users.
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
                        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                          <span>{business.member_count} members</span>
                          <span>{formatTimestamp(business.created_at)}</span>
                        </div>
                        <div className="mt-4 flex items-center justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditError(null);
                              setEditTarget(business);
                              setEditForm({
                                name: business.name,
                                description: business.description || "",
                                category: business.category,
                                status: business.status,
                                stage: business.stage,
                              });
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setDeleteError(null);
                              setDeleteTarget(business);
                            }}
                            className="ml-2"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No businesses have been published yet.
                    </p>
                  )}
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
                  society records.
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

          {currentTab === "Chats" && data && (
            <div className="grid grid-cols-1 gap-8 xl:grid-cols-[380px_1fr]">
              <Card className="border-border/50 bg-card/40 backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-2xl">All Rearvy Users</CardTitle>
                  <CardDescription>
                    Select any logged-in user and open a direct message from admin.
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
                    Admin messages are saved in the same live Rearvy conversation system.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
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
                    <>
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

                      <div className="min-h-[420px] space-y-3 rounded-2xl border border-border/50 bg-background/30 p-4">
                        {chatLoading && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading conversation...
                          </div>
                        )}

                        {!chatLoading && chatMessages.length === 0 && (
                          <p className="text-sm text-muted-foreground">
                            No messages yet. Send the first message from admin.
                          </p>
                        )}

                        {!chatLoading &&
                          chatMessages.map((message) => {
                            const fromAdmin = message.sender_id === data.adminUid;
                            return (
                              <div
                                key={message.id}
                                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                                  fromAdmin
                                    ? "ml-auto bg-gradient-to-r from-slate-700 to-slate-800 text-white"
                                    : "bg-muted text-foreground"
                                }`}
                              >
                                {message.content || ""}
                              </div>
                            );
                          })}
                      </div>

                      <form onSubmit={handleSendAdminChatMessage} className="flex gap-3">
                        <Input
                          value={chatInput}
                          onChange={(event) => setChatInput(event.target.value)}
                          placeholder="Type an admin message..."
                          disabled={chatSending}
                        />
                        <Button type="submit" disabled={chatSending || !selectedChatId}>
                          {chatSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                      </form>
                    </>
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
