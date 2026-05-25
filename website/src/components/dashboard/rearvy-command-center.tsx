"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ElementType } from "react";
import {
  Activity,
  BarChart3,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Compass,
  FileSearch,
  FolderKanban,
  Gauge,
  Globe2,
  Image,
  Laptop,
  LineChart,
  Loader2,
  MessageSquare,
  MousePointer2,
  Plug,
  Radio,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Workflow,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getIdToken } from "@/lib/firebase/auth";
import { cn } from "@/lib/utils";

type DashboardData = {
  recentChats?: Array<{ id: string; title: string; updated_at: string }>;
  projects?: Array<{ id: string; name: string }>;
};

type WorkSummary = {
  counts?: Record<string, number>;
  readiness?: Record<string, boolean | string | number>;
};

type CapabilityCategory = "command" | "data" | "automation" | "growth";
type CapabilityStatus = "live" | "setup" | "desktop" | "advanced";
type CapabilityFilter = CapabilityCategory | "all" | "favorites";

type Capability = {
  title: string;
  description: string;
  href: string;
  category: CapabilityCategory;
  icon: ElementType;
  status: CapabilityStatus;
  keywords: string[];
};

type WorkflowTemplate = {
  title: string;
  description: string;
  href: string;
  icon: ElementType;
  steps: string[];
};

type ReadinessItem = {
  label: string;
  ready: boolean;
  detail: string;
  href: string;
};

const FAVORITES_STORAGE_KEY = "rearvy.commandCenter.favoriteCapabilities.v1";

const CAPABILITIES: Capability[] = [
  {
    title: "AI chat",
    description: "Ask questions, generate plans, and work across connected context.",
    href: "/chat/new",
    category: "command",
    icon: MessageSquare,
    status: "live",
    keywords: ["assistant", "conversation", "planning", "answers"],
  },
  {
    title: "Work agents",
    description: "Create specialized agents for briefs, research, retention, and operations.",
    href: "/work/agents",
    category: "automation",
    icon: Bot,
    status: "live",
    keywords: ["agents", "specialists", "delegation", "team"],
  },
  {
    title: "Automations",
    description: "Schedule recurring work, reviews, and monitor-style tasks.",
    href: "/work/automations",
    category: "automation",
    icon: Workflow,
    status: "advanced",
    keywords: ["schedule", "recurring", "monitor", "jobs"],
  },
  {
    title: "Source research",
    description: "Run supplier, competitor, trend, and audience research tasks.",
    href: "/work/sources",
    category: "growth",
    icon: FileSearch,
    status: "live",
    keywords: ["research", "supplier", "competitor", "trend"],
  },
  {
    title: "Browser operator",
    description: "Use local browser sessions for public research and app workflows.",
    href: "/work/browser",
    category: "automation",
    icon: Globe2,
    status: "desktop",
    keywords: ["browser", "web", "operator", "desktop"],
  },
  {
    title: "Channels",
    description: "Prepare Telegram, Discord, Slack, WhatsApp, and team reply flows.",
    href: "/work/channels",
    category: "growth",
    icon: Radio,
    status: "setup",
    keywords: ["telegram", "discord", "slack", "whatsapp", "messages"],
  },
  {
    title: "Integrations",
    description: "Connect Shopify, GA4, YouTube, Instagram, Gmail, GitHub, and more.",
    href: "/work/integrations",
    category: "data",
    icon: Plug,
    status: "setup",
    keywords: ["shopify", "ga4", "youtube", "gmail", "github", "data"],
  },
  {
    title: "Runs and approvals",
    description: "Review work history, approvals, failures, and queued jobs.",
    href: "/work/runs",
    category: "automation",
    icon: ShieldCheck,
    status: "live",
    keywords: ["approvals", "history", "runs", "queue", "audit"],
  },
  {
    title: "Insights",
    description: "Review KPI shifts, strategic notes, and business summaries.",
    href: "/insights",
    category: "data",
    icon: LineChart,
    status: "live",
    keywords: ["kpi", "analytics", "reports", "summary"],
  },
  {
    title: "Operations",
    description: "Monitor queues, local runtime status, approvals, and system health.",
    href: "/terminal",
    category: "command",
    icon: Activity,
    status: "advanced",
    keywords: ["terminal", "runtime", "health", "queue"],
  },
  {
    title: "Projects",
    description: "Group chats, data, and work around clients or initiatives.",
    href: "/projects",
    category: "command",
    icon: BriefcaseBusiness,
    status: "live",
    keywords: ["workspace", "clients", "folders", "initiatives"],
  },
  {
    title: "Clicky",
    description: "Use the desktop bubble for screen-aware assistance and fast actions.",
    href: "/clicky",
    category: "command",
    icon: MousePointer2,
    status: "desktop",
    keywords: ["desktop", "screen", "bubble", "quick actions"],
  },
  {
    title: "Trading AI",
    description: "Run guarded trade opinions, monitors, and market analysis.",
    href: "/trading/ai-trader",
    category: "data",
    icon: TrendingUp,
    status: "advanced",
    keywords: ["trading", "market", "guardrails", "monitor"],
  },
  {
    title: "Media generation",
    description: "Create image and video concepts from prompts.",
    href: "/generate-media",
    category: "growth",
    icon: Image,
    status: "advanced",
    keywords: ["image", "video", "creative", "prompt"],
  },
];

const WORKFLOWS: WorkflowTemplate[] = [
  {
    title: "Market-to-concept sprint",
    description: "Research a product space, collect sources, and turn findings into a launch concept.",
    href: "/work/sources",
    icon: Compass,
    steps: ["Run source research", "Summarize candidates", "Send findings into chat"],
  },
  {
    title: "Weekly client brief",
    description: "Use a work agent to turn recent performance into a client-ready review.",
    href: "/work/agents",
    icon: ClipboardCheck,
    steps: ["Pick brief agent", "Review data gaps", "Generate actions"],
  },
  {
    title: "Ops watchdog",
    description: "Schedule recurring checks for failed syncs, unanswered channels, and KPI movement.",
    href: "/work/automations",
    icon: Gauge,
    steps: ["Create automation", "Set cadence", "Review runs"],
  },
  {
    title: "Channel response desk",
    description: "Prepare outbound replies and approval-gated auto-reply shells.",
    href: "/work/channels",
    icon: Send,
    steps: ["Connect channel", "Draft response rules", "Approve sends"],
  },
  {
    title: "Desktop investigation",
    description: "Use local browser and desktop tools when public pages or local files matter.",
    href: "/work/browser",
    icon: Laptop,
    steps: ["Open browser task", "Inspect evidence", "Save result"],
  },
];

const CATEGORY_LABELS: Record<Capability["category"], string> = {
  command: "Command",
  data: "Data",
  automation: "Automation",
  growth: "Growth",
};

const CATEGORY_FILTERS: Array<{ value: CapabilityFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "favorites", label: "Favorites" },
  { value: "command", label: "Command" },
  { value: "data", label: "Data" },
  { value: "automation", label: "Automation" },
  { value: "growth", label: "Growth" },
];

const STATUS_STYLES: Record<Capability["status"], string> = {
  live: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  setup: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  desktop: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  advanced: "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300",
};

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

function formatCount(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function statusLabel(status: Capability["status"]) {
  if (status === "live") return "Live";
  if (status === "setup") return "Setup";
  if (status === "desktop") return "Desktop";
  return "Advanced";
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function capabilityMatchesQuery(capability: Capability, query: string) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return true;
  }

  const searchableText = [
    capability.title,
    capability.description,
    capability.href,
    capability.category,
    capability.status,
    ...capability.keywords,
  ]
    .join(" ")
    .toLowerCase();

  return searchableText.includes(normalizedQuery);
}

function getTimestamp(value: string | undefined) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function formatDateLabel(value: string | undefined) {
  const timestamp = getTimestamp(value);
  if (!timestamp) {
    return "Recent";
  }

  return DATE_FORMATTER.format(new Date(timestamp));
}

function readFavoriteHrefs() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    const parsedValue = rawValue ? JSON.parse(rawValue) : [];
    if (!Array.isArray(parsedValue)) {
      return [];
    }

    const knownHrefs = new Set(CAPABILITIES.map((capability) => capability.href));
    return parsedValue.filter(
      (href): href is string => typeof href === "string" && knownHrefs.has(href)
    );
  } catch {
    return [];
  }
}

function writeFavoriteHrefs(hrefs: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(hrefs));
}

function getReadinessItems(summary: WorkSummary | null, dashboard: DashboardData | null): ReadinessItem[] {
  const counts = summary?.counts ?? {};
  const readiness = summary?.readiness ?? {};
  const projects = dashboard?.projects?.length ?? 0;
  const chats = dashboard?.recentChats?.length ?? 0;
  const desktopRuntime = readiness.desktopRuntime === true || readiness.pairing === "local";

  return [
    {
      label: "Project workspace",
      ready: projects > 0,
      detail: projects > 0 ? `${projects} project${projects === 1 ? "" : "s"}` : "Create your first project",
      href: projects > 0 ? "/projects" : "/projects/new",
    },
    {
      label: "Connected data",
      ready: formatCount(counts.integrations) > 0,
      detail: `${formatCount(counts.integrations)} integration${formatCount(counts.integrations) === 1 ? "" : "s"}`,
      href: "/work/integrations",
    },
    {
      label: "Agent bench",
      ready: formatCount(counts.agents) > 0,
      detail: `${formatCount(counts.agents)} agent${formatCount(counts.agents) === 1 ? "" : "s"}`,
      href: "/work/agents",
    },
    {
      label: "Automation loop",
      ready: formatCount(counts.automations) > 0,
      detail: `${formatCount(counts.automations)} automation${formatCount(counts.automations) === 1 ? "" : "s"}`,
      href: "/work/automations",
    },
    {
      label: "Research pipeline",
      ready: formatCount(counts.sourceTasks) > 0,
      detail: `${formatCount(counts.sourceTasks)} source task${formatCount(counts.sourceTasks) === 1 ? "" : "s"}`,
      href: "/work/sources",
    },
    {
      label: "Channel desk",
      ready: formatCount(counts.channelConnections) > 0,
      detail: `${formatCount(counts.channelConnections)} channel${formatCount(counts.channelConnections) === 1 ? "" : "s"}`,
      href: "/work/channels",
    },
    {
      label: "Desktop runtime",
      ready: desktopRuntime,
      detail: desktopRuntime ? "Local runtime available" : "Use desktop app for full power",
      href: desktopRuntime ? "/terminal" : "/download",
    },
    {
      label: "Conversation memory",
      ready: chats > 0,
      detail: chats > 0 ? `${chats} recent chat${chats === 1 ? "" : "s"}` : "Start a chat",
      href: "/chat/new",
    },
  ];
}

function buildNextActions(readinessItems: ReadinessItem[]) {
  const notReady = readinessItems.filter((item) => !item.ready).slice(0, 6);
  if (notReady.length > 0) {
    return notReady;
  }

  return readinessItems
    .filter((item) => item.ready)
    .slice(0, 6)
    .map((item) => ({
      ...item,
      detail: `Review ${item.label.toLowerCase()}`,
    }));
}

function CapabilityCard({
  capability,
  isFavorite,
  onToggleFavorite,
}: {
  capability: Capability;
  isFavorite: boolean;
  onToggleFavorite: (href: string) => void;
}) {
  const Icon = capability.icon;

  return (
    <Card className="h-full rounded-lg border-border/70 py-4 transition-colors hover:bg-accent/30">
      <CardHeader className="gap-3 px-4 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border bg-background">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="outline" className={cn("border", STATUS_STYLES[capability.status])}>
              {statusLabel(capability.status)}
            </Badge>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className={cn("text-muted-foreground", isFavorite && "text-amber-500")}
              aria-label={isFavorite ? `Unpin ${capability.title}` : `Pin ${capability.title}`}
              onClick={() => onToggleFavorite(capability.href)}
            >
              <Star className={cn("h-3 w-3", isFavorite && "fill-current")} />
            </Button>
          </div>
        </div>
        <div>
          <CardTitle className="text-sm">{capability.title}</CardTitle>
          <CardDescription className="mt-1 line-clamp-3 text-xs leading-5">
            {capability.description}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="px-4 pt-2">
        <Button asChild size="sm" variant="outline" className="w-full">
          <Link href={capability.href}>
            Open
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function WorkflowCard({ workflow }: { workflow: WorkflowTemplate }) {
  const Icon = workflow.icon;

  return (
    <Card className="rounded-lg border-border/70">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-background">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-sm">{workflow.title}</CardTitle>
            <CardDescription className="mt-1 text-xs leading-5">
              {workflow.description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ol className="space-y-2 text-xs text-muted-foreground">
          {workflow.steps.map((step, index) => (
            <li key={step} className="flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px]">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <Button asChild size="sm" variant="outline" className="w-full">
          <Link href={workflow.href}>
            Open workflow
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function MetricTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border/70 bg-card px-4 py-3">
      <div className="truncate text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 truncate text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function ReadinessLink({ item }: { item: ReadinessItem }) {
  return (
    <Link
      href={item.href}
      className="flex min-w-0 items-start gap-2 rounded-md border border-border/60 px-3 py-2 text-sm transition-colors hover:bg-accent/40"
    >
      {item.ready ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
      ) : (
        <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      )}
      <span className="min-w-0">
        <span className="block truncate font-medium">{item.label}</span>
        <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
      </span>
    </Link>
  );
}

function RecentWorkspacePanel({ dashboard }: { dashboard: DashboardData | null }) {
  const recentChats = dashboard?.recentChats?.slice(0, 4) ?? [];
  const projects = dashboard?.projects?.slice(0, 4) ?? [];

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border border-border/70 bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Recent chats</h2>
          </div>
          <Button asChild size="sm" variant="ghost">
            <Link href="/chats">View all</Link>
          </Button>
        </div>
        <div className="space-y-2">
          {recentChats.length > 0 ? (
            recentChats.map((chat) => (
              <Link
                key={chat.id}
                href={`/chat/${chat.id}`}
                className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2 text-sm transition-colors hover:bg-accent/40"
              >
                <span className="min-w-0 truncate font-medium">{chat.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDateLabel(chat.updated_at)}
                </span>
              </Link>
            ))
          ) : (
            <Link
              href="/chat/new"
              className="flex items-center justify-between rounded-md border border-dashed border-border/70 px-3 py-3 text-sm text-muted-foreground transition-colors hover:bg-accent/40"
            >
              Start the first chat
              <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border/70 bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Active projects</h2>
          </div>
          <Button asChild size="sm" variant="ghost">
            <Link href="/projects">View all</Link>
          </Button>
        </div>
        <div className="space-y-2">
          {projects.length > 0 ? (
            projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2 text-sm transition-colors hover:bg-accent/40"
              >
                <span className="min-w-0 truncate font-medium">{project.name}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))
          ) : (
            <Link
              href="/projects/new"
              className="flex items-center justify-between rounded-md border border-dashed border-border/70 px-3 py-3 text-sm text-muted-foreground transition-colors hover:bg-accent/40"
            >
              Create a project workspace
              <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

export function RearvyCommandCenter() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [summary, setSummary] = useState<WorkSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [capabilityFilter, setCapabilityFilter] = useState<CapabilityFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [favoriteHrefs, setFavoriteHrefs] = useState<string[]>([]);

  const loadCommandCenter = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);

    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error("Missing auth token.");
      }

      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };

      if (typeof window !== "undefined" && window.electron) {
        headers["x-rearvy-desktop"] = "1";
      }

      const [dashboardResponse, summaryResponse] = await Promise.all([
        fetch("/api/dashboard/data", { headers, signal }),
        fetch("/api/work/summary", { headers, signal }),
      ]);

      if (!dashboardResponse.ok) {
        throw new Error("Dashboard data could not be loaded.");
      }

      if (!summaryResponse.ok) {
        throw new Error("Work summary could not be loaded.");
      }

      const [dashboardPayload, summaryPayload] = await Promise.all([
        dashboardResponse.json() as Promise<DashboardData>,
        summaryResponse.json() as Promise<WorkSummary>,
      ]);

      if (signal?.aborted) {
        return;
      }

      setDashboard(dashboardPayload);
      setSummary(summaryPayload);
      setLastUpdatedAt(new Date());
    } catch (loadError) {
      if (signal?.aborted) {
        return;
      }

      setError(loadError instanceof Error ? loadError.message : "Could not load command center.");
      setDashboard({ projects: [], recentChats: [] });
      setSummary({ counts: {}, readiness: {} });
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void loadCommandCenter(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadCommandCenter]);

  useEffect(() => {
    setFavoriteHrefs(readFavoriteHrefs());
  }, []);

  const favoriteSet = useMemo(() => new Set(favoriteHrefs), [favoriteHrefs]);

  const handleToggleFavorite = useCallback((href: string) => {
    setFavoriteHrefs((currentHrefs) => {
      const nextHrefs = currentHrefs.includes(href)
        ? currentHrefs.filter((currentHref) => currentHref !== href)
        : [href, ...currentHrefs].slice(0, 12);

      try {
        writeFavoriteHrefs(nextHrefs);
      } catch {
        // Ignore storage failures; the in-memory state still updates for this session.
      }

      return nextHrefs;
    });
  }, []);

  const readinessItems = useMemo(() => getReadinessItems(summary, dashboard), [dashboard, summary]);
  const nextActions = useMemo(() => buildNextActions(readinessItems), [readinessItems]);
  const readyCount = readinessItems.filter((item) => item.ready).length;
  const readinessPercent =
    readinessItems.length > 0 ? Math.round((readyCount / readinessItems.length) * 100) : 0;
  const counts = summary?.counts ?? {};
  const setupNeededCount = readinessItems.length - readyCount;
  const liveCapabilityCount = CAPABILITIES.filter((capability) => capability.status === "live").length;
  const filteredCapabilities = useMemo(() => {
    return CAPABILITIES.filter((capability) => {
      const matchesFilter =
        capabilityFilter === "all" ||
        (capabilityFilter === "favorites"
          ? favoriteSet.has(capability.href)
          : capability.category === capabilityFilter);

      return matchesFilter && capabilityMatchesQuery(capability, searchQuery);
    }).sort((left, right) => {
      const favoriteDelta = Number(favoriteSet.has(right.href)) - Number(favoriteSet.has(left.href));
      if (favoriteDelta !== 0) {
        return favoriteDelta;
      }

      return left.title.localeCompare(right.title);
    });
  }, [capabilityFilter, favoriteSet, searchQuery]);
  const groupedCapabilities = useMemo(() => {
    return filteredCapabilities.reduce<Record<Capability["category"], Capability[]>>(
      (groups, capability) => {
        groups[capability.category].push(capability);
        return groups;
      },
      { command: [], data: [], automation: [], growth: [] }
    );
  }, [filteredCapabilities]);
  const visibleCapabilityCategories = (
    Object.keys(groupedCapabilities) as Array<Capability["category"]>
  ).filter((category) => groupedCapabilities[category].length > 0);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            Rearvy Command Center
          </div>
          <div className="max-w-3xl space-y-3">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Run the business workspace from one place.
            </h1>
            <p className="text-sm leading-6 text-muted-foreground sm:text-base">
              Launch chat, agents, automations, source research, channel operations,
              local desktop workflows, insights, and connected-data actions without
              hunting through the app.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/chat/new">
                <MessageSquare className="h-4 w-4" />
                Start with AI
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/work">
                <Workflow className="h-4 w-4" />
                Open Work Platform
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/work/integrations">
                <Plug className="h-4 w-4" />
                Connect data
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadCommandCenter()}
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              Refresh
            </Button>
          </div>
          {lastUpdatedAt ? (
            <div className="text-xs text-muted-foreground">
              Updated {lastUpdatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-border/70 bg-card p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Workspace readiness</div>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-4xl font-semibold tracking-tight">{readinessPercent}%</span>
                <span className="pb-1 text-sm text-muted-foreground">
                  {readyCount}/{readinessItems.length} ready
                </span>
              </div>
            </div>
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : error ? (
              <XCircle className="h-5 w-5 text-amber-500" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            )}
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${readinessPercent}%` }}
            />
          </div>
          {error ? (
            <p className="mt-3 text-xs leading-5 text-amber-600 dark:text-amber-300">{error}</p>
          ) : null}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {readinessItems.map((item) => (
              <ReadinessLink key={item.label} item={item} />
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Feature modules"
          value={CAPABILITIES.length}
          detail={`${liveCapabilityCount} live, ${favoriteHrefs.length} pinned`}
        />
        <MetricTile
          label="Connected data"
          value={formatCount(counts.integrations)}
          detail={`${formatCount(counts.mcpServers)} MCP servers available`}
        />
        <MetricTile
          label="Work activity"
          value={formatCount(counts.runs)}
          detail={`${formatCount(counts.automations)} automations, ${formatCount(counts.teams)} teams`}
        />
        <MetricTile
          label="Setup gaps"
          value={setupNeededCount}
          detail={setupNeededCount === 0 ? "Workspace is ready" : "Prioritized below"}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {nextActions.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border/70 bg-card px-4 py-3 transition-colors hover:bg-accent/40"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{action.label}</span>
              <span className="block truncate text-xs text-muted-foreground">{action.detail}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </section>

      <RecentWorkspacePanel dashboard={dashboard} />

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Capability launcher</h2>
            <p className="text-sm text-muted-foreground">
              The main feature surface Rearvy should expose for day-to-day work.
            </p>
          </div>
          <Badge variant="outline">
            {filteredCapabilities.length}/{CAPABILITIES.length} modules
          </Badge>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search modules"
              className="pl-9"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {CATEGORY_FILTERS.map((filter) => (
              <Button
                key={filter.value}
                type="button"
                size="sm"
                variant={capabilityFilter === filter.value ? "secondary" : "outline"}
                onClick={() => setCapabilityFilter(filter.value)}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {visibleCapabilityCategories.length > 0 ? (
            visibleCapabilityCategories.map((category) => (
              <div key={category} className="space-y-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">{CATEGORY_LABELS[category]}</h3>
                  <Badge variant="outline">{groupedCapabilities[category].length}</Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {groupedCapabilities[category].map((capability) => (
                    <CapabilityCard
                      key={capability.title}
                      capability={capability}
                      isFavorite={favoriteSet.has(capability.href)}
                      onToggleFavorite={handleToggleFavorite}
                    />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
              No modules match the current filters.
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Suggested operating plays</h2>
          <p className="text-sm text-muted-foreground">
            Feature bundles that make existing Rearvy systems feel like complete workflows.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {WORKFLOWS.map((workflow) => (
            <WorkflowCard key={workflow.title} workflow={workflow} />
          ))}
        </div>
      </section>
    </div>
  );
}
