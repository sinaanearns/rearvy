"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ElementType } from "react";
import {
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
  Star,
  Terminal,
  TrendingUp,
  Workflow,
  XCircle,
} from "lucide-react";

import { RearvyLogo } from "@/components/brand/rearvy-logo";
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
    title: "Projects",
    description: "Group chats, data, and work around clients or initiatives.",
    href: "/projects",
    category: "command",
    icon: BriefcaseBusiness,
    status: "live",
    keywords: ["workspace", "clients", "folders", "initiatives"],
  },
  {
    title: "Maria",
    description: "Use the desktop bubble for screen-aware assistance and fast actions.",
    href: "/maria",
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
  { value: "favorites", label: "Pinned" },
  { value: "command", label: "Command" },
  { value: "data", label: "Data" },
  { value: "automation", label: "Automation" },
  { value: "growth", label: "Growth" },
];

const STATUS_STYLES: Record<Capability["status"], string> = {
  live: "border-emerald-700 bg-emerald-100 text-emerald-950",
  setup: "border-amber-600 bg-amber-100 text-amber-950",
  desktop: "border-sky-700 bg-sky-100 text-sky-950",
  advanced: "border-violet-700 bg-violet-100 text-violet-950",
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
      detail: projects > 0 ? `${projects} project${projects === 1 ? "" : "s"}` : "Create first project",
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
      detail: desktopRuntime ? "Local runtime available" : "Open desktop app",
      href: desktopRuntime ? "/maria" : "/download",
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
    <article className="flex h-full min-h-[270px] flex-col border-2 border-white bg-[#050505] p-4 shadow-[6px_6px_0_rgba(255,255,255,0.24)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-white bg-white text-black">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "border-2 px-2 py-1 text-[10px] font-black uppercase leading-none tracking-[0.14em]",
              STATUS_STYLES[capability.status]
            )}
          >
            {statusLabel(capability.status)}
          </span>
          <button
            type="button"
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center border-2 border-white transition-colors hover:bg-white hover:text-black",
              isFavorite ? "bg-white text-black" : "bg-black text-white"
            )}
            aria-label={isFavorite ? `Unpin ${capability.title}` : `Pin ${capability.title}`}
            onClick={() => onToggleFavorite(capability.href)}
          >
            <Star className={cn("h-4 w-4", isFavorite && "fill-current")} />
          </button>
        </div>
      </div>
      <div className="mt-8 min-w-0 flex-1">
        <h3 className="font-poster text-[34px] leading-none text-white">{capability.title}</h3>
        <p className="mt-4 text-sm font-bold leading-6 text-white/70">{capability.description}</p>
      </div>
      <Link href={capability.href} className="campaign-button campaign-button-invert mt-6 h-10 px-3 text-[10px]">
        Open
        <ChevronRight className="h-4 w-4" />
      </Link>
    </article>
  );
}

function WorkflowCard({ workflow }: { workflow: WorkflowTemplate }) {
  const Icon = workflow.icon;

  return (
    <article className="flex h-full flex-col border-2 border-black bg-white p-5 shadow-[6px_6px_0_#050505]">
      <Icon className="h-8 w-8" strokeWidth={2} />
      <h3 className="mt-8 font-poster text-[36px] leading-none">{workflow.title}</h3>
      <p className="mt-4 text-sm font-bold leading-6 text-black/68">{workflow.description}</p>
      <ol className="mt-6 flex-1 border-y-2 border-black">
        {workflow.steps.map((step, index) => (
          <li
            key={step}
            className="grid grid-cols-[36px_1fr] items-center border-b-2 border-black py-3 last:border-b-0"
          >
            <span className="font-poster text-2xl leading-none">{index + 1}</span>
            <span className="text-xs font-black uppercase tracking-[0.14em] text-black/68">
              {step}
            </span>
          </li>
        ))}
      </ol>
      <Link href={workflow.href} className="campaign-button campaign-button-dark mt-6 h-10 px-3 text-[10px]">
        Open play
        <ChevronRight className="h-4 w-4" />
      </Link>
    </article>
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
    <div className="min-w-0 py-4 sm:px-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-black/62">
        {label}
      </div>
      <div className="mt-2 font-poster text-[44px] leading-none">{value}</div>
      <div className="mt-2 truncate text-xs font-bold text-black/64">
        {detail}
      </div>
    </div>
  );
}

function ReadinessLink({ item }: { item: ReadinessItem }) {
  return (
    <Link
      href={item.href}
      className="grid min-h-[78px] grid-cols-[28px_1fr] gap-3 border-b-2 border-black px-3 py-3 transition-colors hover:bg-black hover:text-white sm:border-r-2 sm:[&:nth-child(2n)]:border-r-0"
    >
      {item.ready ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
      ) : (
        <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      )}
      <span className="min-w-0">
        <span className="block truncate text-sm font-black">{item.label}</span>
        <span className="mt-1 block truncate text-xs font-bold opacity-65">{item.detail}</span>
      </span>
    </Link>
  );
}

function NextActionLink({ action, index }: { action: ReadinessItem; index: number }) {
  return (
    <Link
      href={action.href}
      className="group grid min-h-[116px] grid-cols-[56px_1fr_auto] items-center gap-4 border-2 border-black bg-white p-4 shadow-[5px_5px_0_#050505] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_#050505]"
    >
      <span className="font-poster text-[42px] leading-none">{String(index + 1).padStart(2, "0")}</span>
      <span className="min-w-0">
        <span className="block truncate text-base font-black">{action.label}</span>
        <span className="mt-1 block truncate text-sm font-bold text-black/62">{action.detail}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" />
    </Link>
  );
}

function RecentWorkspacePanel({ dashboard }: { dashboard: DashboardData | null }) {
  const recentChats = dashboard?.recentChats?.slice(0, 4) ?? [];
  const projects = dashboard?.projects?.slice(0, 4) ?? [];

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <div className="border-2 border-black bg-white shadow-[6px_6px_0_#050505]">
        <div className="flex items-center justify-between gap-3 border-b-2 border-black px-4 py-3">
          <div className="flex items-center gap-2">
            <Clock3 className="h-4 w-4" />
            <h2 className="text-sm font-black uppercase tracking-[0.16em]">Recent chats</h2>
          </div>
          <Link href="/chats" className="text-xs font-black uppercase tracking-[0.14em] hover:underline">
            View all
          </Link>
        </div>
        <div>
          {recentChats.length > 0 ? (
            recentChats.map((chat) => (
              <Link
                key={chat.id}
                href={`/chat/${chat.id}`}
                className="grid min-w-0 grid-cols-[1fr_auto] items-center gap-3 border-b-2 border-black px-4 py-3 text-sm transition-colors last:border-b-0 hover:bg-black hover:text-white"
              >
                <span className="min-w-0 truncate font-black">{chat.title}</span>
                <span className="shrink-0 text-xs font-bold opacity-65">{formatDateLabel(chat.updated_at)}</span>
              </Link>
            ))
          ) : (
            <Link
              href="/chat/new"
              className="flex items-center justify-between px-4 py-5 text-sm font-black uppercase tracking-[0.14em] transition-colors hover:bg-black hover:text-white"
            >
              Start first chat
              <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      <div className="border-2 border-black bg-white shadow-[6px_6px_0_#050505]">
        <div className="flex items-center justify-between gap-3 border-b-2 border-black px-4 py-3">
          <div className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4" />
            <h2 className="text-sm font-black uppercase tracking-[0.16em]">Active projects</h2>
          </div>
          <Link href="/projects" className="text-xs font-black uppercase tracking-[0.14em] hover:underline">
            View all
          </Link>
        </div>
        <div>
          {projects.length > 0 ? (
            projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="grid min-w-0 grid-cols-[1fr_auto] items-center gap-3 border-b-2 border-black px-4 py-3 text-sm transition-colors last:border-b-0 hover:bg-black hover:text-white"
              >
                <span className="min-w-0 truncate font-black">{project.name}</span>
                <ChevronRight className="h-4 w-4 shrink-0" />
              </Link>
            ))
          ) : (
            <Link
              href="/projects/new"
              className="flex items-center justify-between px-4 py-5 text-sm font-black uppercase tracking-[0.14em] transition-colors hover:bg-black hover:text-white"
            >
              Create project workspace
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
    <div className="-m-4 min-h-[calc(100dvh-5rem)] bg-[#f2f2f2] text-[#050505] md:-m-6">
      <section className="poster-grain xerox-noise relative overflow-hidden border-b-2 border-black bg-[#f2f2f2] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto grid max-w-[1500px] gap-8 lg:grid-cols-[0.54fr_0.46fr] lg:items-stretch">
          <div className="poster-rise flex min-w-0 flex-col justify-between gap-8">
            <div>
              <div className="mb-6 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
                <span className="stamp-label">Command center</span>
                <span className="stamp-label">Workspace setup</span>
                <span className="stamp-label">Live ops</span>
              </div>

              <RearvyLogo
                priority
                markSize={42}
                variant="dark"
                className="mb-5 text-black"
                markClassName="h-10 w-10 rounded-none"
                textClassName="font-poster text-[30px] uppercase leading-none"
              />

              <h1 className="font-poster text-[54px] leading-[0.86] text-black sm:text-[78px] lg:text-[100px] xl:text-[118px]">
                <span className="block">COMMAND</span>
                <span className="block">REARVY</span>
                <span className="block">WORKSPACE.</span>
              </h1>

              <div className="mt-7 grid max-w-4xl gap-6 border-t-4 border-black pt-6 xl:grid-cols-[1fr_auto] xl:items-end">
                <p className="max-w-2xl text-base font-black leading-7 text-black sm:text-lg">
                  Launch chat, agents, automations, research, channel operations,
                  local desktop workflows, insights, and connected-data actions
                  from one operational setup board.
                </p>
                <div className="flex flex-wrap gap-3 xl:flex-col">
                  <Link href="/chat/new" className="campaign-button campaign-button-dark h-12 px-5">
                    <MessageSquare className="h-4 w-4" />
                    Start AI
                  </Link>
                  <Link href="/work" className="campaign-button campaign-button-light h-12 px-5">
                    <Workflow className="h-4 w-4" />
                    Work platform
                  </Link>
                  <Link href="/work/integrations" className="campaign-button campaign-button-light h-12 px-5">
                    <Plug className="h-4 w-4" />
                    Connect data
                  </Link>
                  <button
                    type="button"
                    className={cn(
                      "campaign-button campaign-button-light h-12 px-5",
                      isLoading && "cursor-wait opacity-60"
                    )}
                    onClick={() => void loadCommandCenter()}
                    disabled={isLoading}
                  >
                    <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                    Refresh
                  </button>
                </div>
              </div>

              {lastUpdatedAt ? (
                <div className="mt-5 inline-flex border-2 border-black bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] shadow-[3px_3px_0_#050505]">
                  Updated {lastUpdatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              ) : null}
            </div>

            <div className="grid border-y-2 border-black sm:grid-cols-4 sm:divide-x-2 sm:divide-black">
              <MetricTile
                label="Modules"
                value={CAPABILITIES.length}
                detail={`${liveCapabilityCount} live`}
              />
              <MetricTile
                label="Data"
                value={formatCount(counts.integrations)}
                detail={`${formatCount(counts.mcpServers)} MCP servers`}
              />
              <MetricTile
                label="Runs"
                value={formatCount(counts.runs)}
                detail={`${formatCount(counts.automations)} automations`}
              />
              <MetricTile
                label="Gaps"
                value={setupNeededCount}
                detail={setupNeededCount === 0 ? "Workspace ready" : "Setup queue"}
              />
            </div>
          </div>

          <div className="poster-rise relative min-h-[460px] border-2 border-black bg-white shadow-[10px_10px_0_#050505]">
            <div className="flex items-start justify-between gap-4 border-b-2 border-black px-5 py-5">
              <div>
                <p className="stamp-label inline-flex">Setup readiness</p>
                <div className="mt-5 flex items-end gap-3">
                  <span className="font-poster text-[76px] leading-none">{readinessPercent}%</span>
                  <span className="pb-2 text-sm font-black uppercase tracking-[0.16em] text-black/62">
                    {readyCount}/{readinessItems.length} ready
                  </span>
                </div>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-black bg-[#f2f2f2]">
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : error ? (
                  <XCircle className="h-5 w-5 text-amber-600" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                )}
              </div>
            </div>
            <div className="px-5 py-5">
              <div className="h-5 border-2 border-black bg-[#d8d8d8]">
                <div
                  className="h-full bg-black transition-[width]"
                  style={{ width: `${readinessPercent}%` }}
                />
              </div>
              {error ? (
                <p className="mt-4 border-2 border-amber-600 bg-amber-100 px-3 py-2 text-xs font-bold leading-5 text-amber-950">
                  {error}
                </p>
              ) : null}
            </div>
            <div className="grid border-t-2 border-black sm:grid-cols-2">
              {readinessItems.map((item) => (
                <ReadinessLink key={item.label} item={item} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b-2 border-black bg-[#f2f2f2] px-4 py-12 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-[1500px]">
          <div className="flex flex-col gap-5 border-b-4 border-black pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="stamp-label inline-flex">Setup queue</p>
              <h2 className="mt-5 font-poster text-[46px] leading-[0.9] sm:text-[72px]">
                NEXT WORKSPACE MOVES.
              </h2>
            </div>
            <div className="flex items-center gap-3 border-2 border-black bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.16em] shadow-[4px_4px_0_#050505]">
              <Terminal className="h-4 w-4" />
              {setupNeededCount === 0 ? "All systems ready" : `${setupNeededCount} setup gaps`}
            </div>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {nextActions.map((action, index) => (
              <NextActionLink key={action.label} action={action} index={index} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-b-2 border-black bg-[#f2f2f2] px-4 py-12 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-[1500px]">
          <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="stamp-label inline-flex">Recent workspace</p>
              <h2 className="mt-5 font-poster text-[46px] leading-[0.9] sm:text-[72px]">
                CONTEXT READY TO REOPEN.
              </h2>
            </div>
            <p className="max-w-xl border-l-4 border-black pl-5 text-sm font-black leading-6 text-black/70">
              The command surface keeps recent conversations and project work
              beside setup progress for a cleaner desktop entry point.
            </p>
          </div>
          <RecentWorkspacePanel dashboard={dashboard} />
        </div>
      </section>

      <section className="poster-grain xerox-noise border-b-2 border-black bg-black px-4 py-12 text-white sm:px-6 lg:px-10 lg:py-16">
        <div className="mx-auto max-w-[1500px]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="stamp-label stamp-label-invert inline-flex">Module launcher</p>
              <h2 className="mt-5 font-poster text-[52px] leading-[0.88] sm:text-[82px] lg:text-[96px]">
                MODULES FOR DAILY WORK.
              </h2>
              <p className="mt-5 max-w-2xl border-l-4 border-white pl-5 text-base font-black leading-7 text-white/72">
                Pinned tools, live modules, and local work surfaces stay one
                click from the main command page.
              </p>
            </div>
            <div className="border-2 border-white bg-white px-4 py-3 text-black shadow-[5px_5px_0_rgba(255,255,255,0.4)]">
              <span className="font-poster text-[42px] leading-none">{filteredCapabilities.length}</span>
              <span className="ml-2 text-xs font-black uppercase tracking-[0.16em] text-black/62">
                / {CAPABILITIES.length} modules
              </span>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/62" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search modules"
                className="h-12 w-full border-2 border-white bg-black pl-12 pr-4 text-sm font-bold text-white outline-none placeholder:text-white/55 focus:bg-white focus:text-black focus:placeholder:text-black/50"
              />
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {CATEGORY_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  className={cn(
                    "campaign-button h-10 px-3 text-[10px]",
                    capabilityFilter === filter.value
                      ? "campaign-button-invert"
                      : "campaign-button-outline-invert"
                  )}
                  onClick={() => setCapabilityFilter(filter.value)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-10 space-y-12">
            {visibleCapabilityCategories.length > 0 ? (
              visibleCapabilityCategories.map((category) => (
                <div key={category} className="space-y-5">
                  <div className="flex items-center gap-3 border-b-2 border-white pb-3">
                    <BarChart3 className="h-5 w-5" />
                    <h3 className="font-poster text-[42px] leading-none">{CATEGORY_LABELS[category]}</h3>
                    <span className="border-2 border-white px-2 py-1 text-xs font-black">
                      {groupedCapabilities[category].length}
                    </span>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
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
              <div className="border-2 border-dashed border-white px-4 py-10 text-center text-sm font-black uppercase tracking-[0.16em] text-white/70">
                No modules match the current filters.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="poster-grain border-b-2 border-black bg-[#f2f2f2] px-4 py-12 sm:px-6 lg:px-10 lg:py-16">
        <div className="mx-auto max-w-[1500px]">
          <div className="flex flex-col gap-5 border-b-4 border-black pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="stamp-label inline-flex">Operating plays</p>
              <h2 className="mt-5 font-poster text-[46px] leading-[0.9] sm:text-[72px]">
                RUNS THAT FEEL LIKE SETUP.
              </h2>
            </div>
            <p className="max-w-xl text-sm font-black leading-6 text-black/68">
              Bundled paths for common work: research, briefs, automations,
              channel response, and desktop investigations.
            </p>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
            {WORKFLOWS.map((workflow) => (
              <WorkflowCard key={workflow.title} workflow={workflow} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
