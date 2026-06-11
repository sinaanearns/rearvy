"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState, type ElementType, type ReactNode } from "react";
import {
  Activity,
  Bell,
  BookOpen,
  Brain,
  CheckCircle2,
  Globe2,
  Laptop,
  Loader2,
  Play,
  Plug,
  Plus,
  Radio,
  RefreshCw,
  Send,
  ShieldCheck,
  Terminal,
  Trash2,
  Workflow,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { normalizeHttpUrl } from "@/lib/chat/url-normalization";
import { getIdToken } from "@/lib/firebase/auth";
import { BUILT_IN_ABILITY_TEMPLATES } from "@/lib/work/abilities";
import { cn } from "@/lib/utils";

const IntegrationsPanel = dynamic(
  () =>
    import("@/components/integrations/integrations-panel").then(
      (mod) => mod.IntegrationsPanel
    ),
  {
    loading: () => (
      <div className="rounded-[8px] border border-border/70 bg-card/85 px-4 py-3 text-sm text-muted-foreground shadow-sm">
        Loading integrations...
      </div>
    ),
  }
);

type WorkView =
  | "overview"
  | "skills"
  | "automations"
  | "listeners"
  | "browser"
  | "integrations"
  | "channels"
  | "sources"
  | "memory"
  | "processes"
  | "runs";

type WorkAutomation = {
  id: string;
  name: string;
  task: string;
  schedule: string;
  schedule_label: string;
  run_target: string;
  approval_required: boolean;
  auto_execute_enabled?: boolean;
  trusted_scope?: string;
  is_enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
};

type WorkListener = {
  id: string;
  name: string;
  provider: string;
  query: string;
  status: string;
  schedule_label: string;
  next_run_at: string | null;
  last_run_at: string | null;
  match_count: number;
  auto_execute_enabled: boolean;
  trusted_scope: string;
  error?: string | null;
};

type BrowserSession = {
  id: string;
  task: string;
  createdAt: number;
  isRunning: boolean;
  connectionMethod?: "cdp-direct" | "extension-relay" | "managed-runner" | "cloud-browser";
  status?: string;
  currentUrl?: string | null;
  title?: string | null;
  summary?: string | null;
  setupError?: string | null;
  liveViewUrl?: string | null;
  files?: Array<{
    id: string;
    filename: string;
    type: string;
    downloadUrl: string | null;
    size: number | null;
  }>;
  awaitingApproval?: { id?: string; reason?: string } | null;
  stdout?: string[];
  stderr?: string[];
  actionLog?: Array<{ id: string; action: string; status: string; message: string; timestamp: string }>;
};

type WorkRun = {
  id: string;
  source: string;
  status: string;
  automation_id?: string | null;
  task?: string;
  trigger_type?: string;
  trigger?: string;
  output?: Record<string, unknown> | null;
  error?: string | null;
  created_at?: string;
  started_at?: string | null;
  finished_at?: string | null;
};

type ChannelCatalogItem = {
  provider: string;
  label: string;
  status: string;
  requiredCredentials?: string[];
  browserFallback?: boolean;
};

type ChannelConnection = {
  id: string;
  provider: string;
  label: string;
  status: string;
  external_channel_id?: string | null;
  auto_reply_enabled?: boolean;
  trusted_scope?: string;
};

type PairingState = {
  localRuntime?: boolean;
  devices?: Array<{ id: string; device_name: string; status: string; last_seen_at?: string | null }>;
  tokens?: Array<{ id: string; label: string; status: string; expires_at?: string | null }>;
  currentDevice?: Record<string, unknown>;
};

type SourceCatalogItem = {
  provider: string;
  label: string;
  mode: string;
  status: string;
  officialCredentialKeys?: string[];
  browserFallback?: boolean;
};

type SourceTask = {
  id: string;
  provider: string;
  query: string;
  status: string;
  mode: string;
  error?: string | null;
  created_at?: string;
  output?: Record<string, unknown> | null;
};

type SourceCandidate = {
  id: string;
  provider: string;
  title: string;
  url?: string | null;
  summary?: string | null;
  score?: number;
  price?: string | null;
  moq?: string | null;
  supplier?: string | null;
};

type WorkProcessSession = {
  id: string;
  command: string;
  cwd?: string | null;
  status: string;
  auto_execute_enabled: boolean;
  trusted_scope: string;
  stdout?: string[];
  stderr?: string[];
  exit_code?: number | null;
  local_job_id?: string | null;
  error?: string | null;
  created_at?: string;
  updated_at?: string;
};

type DiaryEntry = {
  id: string;
  entry_date: string;
  title: string;
  summary: string;
  highlights: string[];
  metrics: Record<string, number>;
};

type MemoryRecord = {
  id: string;
  content?: string;
  memory_type?: string;
  tags?: string[];
  importance?: number;
  updated_at?: string;
};

type WorkContext = {
  time?: { iso: string; timezone: string; local: string };
  location?: { city: string | null; region: string | null; country: string | null };
  weather?: Record<string, unknown>;
};

type Summary = {
  counts: Record<string, number>;
  readiness: Record<string, boolean | string>;
};

type WorkPlatformProps = {
  initialView?: WorkView;
};

const WORK_VIEWS: Array<{ id: WorkView; label: string; icon: ElementType }> = [
  { id: "overview", label: "Work", icon: Activity },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "memory", label: "Memory", icon: Brain },
];

const WORK_CARD_CLASS = "overflow-hidden rounded-[8px] border-border/70 bg-card/85 shadow-sm";
const WORK_CARD_INTERACTIVE_CLASS = cn(
  WORK_CARD_CLASS,
  "transition hover:border-primary/30 hover:shadow-md"
);
const WORK_FORM_CONTROL_CLASS = "h-10 w-full rounded-[8px] border bg-background px-3 text-sm";
const WORK_INLINE_PANEL_CLASS = "rounded-[8px] border border-border/70 bg-background/70";

type WorkEmptyStateTone = "cyan" | "emerald" | "amber" | "slate";

const WORK_EMPTY_STATE_TONES: Record<
  WorkEmptyStateTone,
  { shell: string; icon: string; accent: string }
> = {
  cyan: {
    shell: "border-cyan-200/80 bg-cyan-50/55 dark:border-cyan-900/50 dark:bg-cyan-950/20",
    icon: "border-cyan-200 bg-cyan-100 text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/70 dark:text-cyan-300",
    accent: "bg-cyan-500/70",
  },
  emerald: {
    shell: "border-emerald-200/80 bg-emerald-50/55 dark:border-emerald-900/50 dark:bg-emerald-950/20",
    icon: "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/70 dark:text-emerald-300",
    accent: "bg-emerald-500/70",
  },
  amber: {
    shell: "border-amber-200/80 bg-amber-50/55 dark:border-amber-900/50 dark:bg-amber-950/20",
    icon: "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/70 dark:text-amber-300",
    accent: "bg-amber-500/70",
  },
  slate: {
    shell: "border-border/70 bg-background/75",
    icon: "border-border/70 bg-muted text-muted-foreground",
    accent: "bg-muted-foreground/45",
  },
};

const emptyAutomationForm = {
  name: "",
  task: "",
  schedule: "weekdays",
  runTarget: "sync",
  autoExecuteEnabled: false,
  trustedScope: "none",
};

const ABILITY_CATEGORY_ICONS: Record<string, ElementType> = {
  Research: Globe2,
  Analytics: Activity,
  "Local execution": Terminal,
  Operations: Workflow,
  Creation: BookOpen,
  Extensions: Plug,
};

const ABILITY_AVAILABILITY_LABELS: Record<NonNullable<(typeof BUILT_IN_ABILITY_TEMPLATES)[number]["availability"]>, string> = {
  ready: "Built in",
  desktop: "Desktop runtime",
  configured: "Needs setup",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function readJsonRecord(response: Response): Promise<Record<string, unknown>> {
  try {
    const payload: unknown = await response.json();
    return isRecord(payload) ? payload : {};
  } catch {
    return {};
  }
}

function getResponseError(payload: Record<string, unknown>, fallback: string) {
  const error = typeof payload.error === "string" ? payload.error.trim() : "";
  const message = typeof payload.message === "string" ? payload.message.trim() : "";

  return error || message || fallback;
}

function getPayloadArray<T>(payload: Record<string, unknown>, key: string): T[] {
  const value = payload[key];
  return Array.isArray(value) ? (value as T[]) : [];
}

function getPayloadRecord<T extends Record<string, unknown>>(payload: Record<string, unknown>, key: string): T | null {
  const value = payload[key];
  return isRecord(value) ? (value as T) : null;
}

function getPayloadString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value : "";
}

function getSummaryPayload(payload: Record<string, unknown>): Summary | null {
  const counts = isRecord(payload.counts) ? payload.counts : null;
  const readiness = isRecord(payload.readiness) ? payload.readiness : null;

  return counts && readiness
    ? {
        counts: counts as Record<string, number>,
        readiness: readiness as Record<string, boolean | string>,
      }
    : null;
}

const emptyListenerForm = {
  name: "",
  provider: "source",
  query: "",
  schedule: "hourly",
  action: "run_source",
  sourceProvider: "alibaba",
  autoExecuteEnabled: false,
  trustedScope: "none",
};

const emptyChannelForm = {
  provider: "telegram",
  label: "",
  externalChannelId: "",
  autoReplyEnabled: false,
  trustedScope: "none",
};

const emptySourceForm = {
  provider: "reddit",
  query: "",
};

const emptyProcessForm = {
  command: "",
  cwd: "",
  autoExecuteEnabled: false,
  trustedScope: "none",
};

function formatTime(value?: string | number | null) {
  if (!value) return "Not yet";
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (!Number.isFinite(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

function statusVariant(status?: string) {
  if (!status) return "secondary" as const;
  if (["active", "completed", "connected", "local"].includes(status)) return "default" as const;
  if (["failed", "error", "setup_error"].includes(status)) return "destructive" as const;
  return "secondary" as const;
}

function SectionTitle({
  icon: Icon,
  title,
  action,
}: {
  icon: ElementType;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-[8px] border bg-background text-primary shadow-sm">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function WorkEmptyState({
  icon: Icon,
  title,
  detail,
  tone = "cyan",
  compact = false,
}: {
  icon: ElementType;
  title: string;
  detail: string;
  tone?: WorkEmptyStateTone;
  compact?: boolean;
}) {
  const toneStyles = WORK_EMPTY_STATE_TONES[tone];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[8px] border shadow-sm",
        compact ? "p-3" : "min-h-[128px] p-4",
        toneStyles.shell
      )}
    >
      <div className={cn("absolute inset-y-0 left-0 w-1", toneStyles.accent)} />
      <div className="flex min-w-0 items-start gap-3 pl-1">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border",
            toneStyles.icon
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">{title}</div>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            {detail}
          </p>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: ElementType;
}) {
  return (
    <Card className={cn("group hover:-translate-y-0.5", WORK_CARD_INTERACTIVE_CLASS)}>
      <CardContent className="relative flex min-h-[104px] items-center justify-between p-4">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-300 via-emerald-300 to-amber-300 opacity-70" />
        <div>
          <div className="text-3xl font-semibold leading-none tracking-tight">{value}</div>
          <div className="mt-2 text-xs font-medium text-muted-foreground">{label}</div>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-[8px] border bg-background text-muted-foreground transition group-hover:text-primary">
          <Icon className="h-5 w-5" />
        </span>
      </CardContent>
    </Card>
  );
}

function AbilityTemplateCard({
  ability,
  compact = false,
}: {
  ability: (typeof BUILT_IN_ABILITY_TEMPLATES)[number];
  compact?: boolean;
}) {
  const Icon = ABILITY_CATEGORY_ICONS[ability.category] ?? ShieldCheck;
  const availability = ability.availability ?? "ready";

  return (
    <Card className={WORK_CARD_INTERACTIVE_CLASS}>
      <CardContent className={cn("space-y-3 p-4", compact && "space-y-2")}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border bg-background text-primary">
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="truncate font-semibold">{ability.name}</div>
              <div className="line-clamp-2 text-sm text-muted-foreground">
                {ability.description}
              </div>
            </div>
          </div>
          <Badge variant={availability === "ready" ? "default" : "secondary"}>
            {ABILITY_AVAILABILITY_LABELS[availability]}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ability.capabilities.slice(0, compact ? 4 : 8).map((capability) => (
            <Badge key={`${ability.id}-${capability}`} variant="outline" className="text-xs">
              {capability}
            </Badge>
          ))}
        </div>
        {!compact && ability.examples?.length ? (
          <div className={cn(WORK_INLINE_PANEL_CLASS, "space-y-1 p-3 text-xs text-muted-foreground")}>
            {ability.examples.map((example) => (
              <div key={`${ability.id}-${example}`}>{example}</div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function WorkPlatform({ initialView = "overview" }: WorkPlatformProps) {
  const [activeView, setActiveView] = useState<WorkView>(initialView);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [automations, setAutomations] = useState<WorkAutomation[]>([]);
  const [listeners, setListeners] = useState<WorkListener[]>([]);
  const [browserSessions, setBrowserSessions] = useState<BrowserSession[]>([]);
  const [runs, setRuns] = useState<WorkRun[]>([]);
  const [channels, setChannels] = useState<ChannelCatalogItem[]>([]);
  const [channelConnections, setChannelConnections] = useState<ChannelConnection[]>([]);
  const [pairing, setPairing] = useState<PairingState | null>(null);
  const [sourceCatalog, setSourceCatalog] = useState<SourceCatalogItem[]>([]);
  const [sourceTasks, setSourceTasks] = useState<SourceTask[]>([]);
  const [sourceCandidates, setSourceCandidates] = useState<SourceCandidate[]>([]);
  const [processes, setProcesses] = useState<WorkProcessSession[]>([]);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [memories, setMemories] = useState<MemoryRecord[]>([]);
  const [workContext, setWorkContext] = useState<WorkContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [automationForm, setAutomationForm] = useState(emptyAutomationForm);
  const [listenerForm, setListenerForm] = useState(emptyListenerForm);
  const [channelForm, setChannelForm] = useState(emptyChannelForm);
  const [sourceForm, setSourceForm] = useState(emptySourceForm);
  const [processForm, setProcessForm] = useState(emptyProcessForm);
  const [processInput, setProcessInput] = useState("");
  const [memoryQuery, setMemoryQuery] = useState("");
  const [diaryDate, setDiaryDate] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [lastPairingCode, setLastPairingCode] = useState("");
  const [browserTask, setBrowserTask] = useState("");
  const [browserCommand, setBrowserCommand] = useState("");
  const [selectedBrowserSessionId, setSelectedBrowserSessionId] = useState("");

  const authFetch = useCallback(async (url: string, init?: RequestInit) => {
    const token = await getIdToken();
    const headers = new Headers(init?.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (init?.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(url, {
      ...init,
      headers,
      cache: "no-store",
    });
    const payload = await readJsonRecord(response);

    if (!response.ok) {
      throw new Error(getResponseError(payload, `Request failed (${response.status})`));
    }

    return payload;
  }, []);

  const loadData = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      const [
        summaryPayload,
        automationsPayload,
        runsPayload,
        diaryPayload,
        memoriesPayload,
        contextPayload,
      ] = await Promise.all([
        authFetch("/api/work/summary"),
        authFetch("/api/work/automations"),
        authFetch("/api/work/runs?limit=30"),
        authFetch("/api/work/diary?limit=10"),
        authFetch("/api/work/memory/search?limit=20"),
        authFetch("/api/work/context"),
      ]);

      setSummary(getSummaryPayload(summaryPayload));
      setAutomations(getPayloadArray<WorkAutomation>(automationsPayload, "automations"));
      setRuns(getPayloadArray<WorkRun>(runsPayload, "runs"));
      setDiaryEntries(getPayloadArray<DiaryEntry>(diaryPayload, "entries"));
      setMemories(getPayloadArray<MemoryRecord>(memoriesPayload, "memories"));
      setWorkContext(contextPayload);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load Work Platform.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function createAutomation() {
    setSaving("automation");
    try {
      await authFetch("/api/work/automations", {
        method: "POST",
        body: JSON.stringify(automationForm),
      });
      toast.success("Automation saved.");
      setAutomationForm(emptyAutomationForm);
      await loadData();
    } catch (automationError) {
      toast.error(automationError instanceof Error ? automationError.message : "Automation save failed.");
    } finally {
      setSaving(null);
    }
  }

  async function runAutomation(automationId: string) {
    setSaving(`run:${automationId}`);
    try {
      await authFetch(`/api/work/automations/${automationId}/run`, { method: "POST" });
      toast.success("Automation run queued.");
      await loadData();
    } catch (runError) {
      toast.error(runError instanceof Error ? runError.message : "Automation run failed.");
    } finally {
      setSaving(null);
    }
  }

  async function deleteAutomation(automationId: string) {
    setSaving(`delete-automation:${automationId}`);
    try {
      await authFetch(`/api/work/automations/${automationId}`, { method: "DELETE" });
      toast.success("Automation deleted.");
      await loadData();
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Automation delete failed.");
    } finally {
      setSaving(null);
    }
  }

  async function createListener() {
    if (!listenerForm.query.trim()) return;
    setSaving("listener");
    try {
      await authFetch("/api/work/listeners", {
        method: "POST",
        body: JSON.stringify({
          ...listenerForm,
          config: { sourceProvider: listenerForm.sourceProvider },
        }),
      });
      toast.success("Listener saved.");
      setListenerForm(emptyListenerForm);
      await loadData();
    } catch (listenerError) {
      toast.error(listenerError instanceof Error ? listenerError.message : "Listener save failed.");
    } finally {
      setSaving(null);
    }
  }

  async function runListener(listenerId: string) {
    setSaving(`listener-run:${listenerId}`);
    try {
      await authFetch(`/api/work/listeners/${listenerId}/run`, { method: "POST" });
      toast.success("Listener run finished.");
      await loadData();
    } catch (listenerError) {
      toast.error(listenerError instanceof Error ? listenerError.message : "Listener run failed.");
    } finally {
      setSaving(null);
    }
  }

  async function deleteListener(listenerId: string) {
    setSaving(`listener-delete:${listenerId}`);
    try {
      await authFetch(`/api/work/listeners/${listenerId}`, { method: "DELETE" });
      toast.success("Listener archived.");
      await loadData();
    } catch (listenerError) {
      toast.error(listenerError instanceof Error ? listenerError.message : "Listener archive failed.");
    } finally {
      setSaving(null);
    }
  }

  async function startBrowserSession() {
    if (!browserTask.trim()) return;
    setSaving("browser");
    try {
      const payload = await authFetch("/api/work/browser", {
        method: "POST",
        body: JSON.stringify({ task: browserTask }),
      });
      toast.success("Browser session started.");
      setBrowserTask("");
      const sessionId = getPayloadString(payload, "id");
      const session = getPayloadRecord<BrowserSession>(payload, "session");
      setSelectedBrowserSessionId(sessionId);
      if (session) {
        setBrowserSessions((current) => [
          session,
          ...current.filter((currentSession) => currentSession.id !== sessionId),
        ]);
      }
      await loadData();
    } catch (browserError) {
      toast.error(browserError instanceof Error ? browserError.message : "Browser session failed.");
    } finally {
      setSaving(null);
    }
  }

  async function sendBrowserCommand(command: string, sessionId = selectedBrowserSessionId) {
    if (!sessionId || !command.trim()) return;
    setSaving("browser-command");
    try {
      await authFetch(`/api/browser/sessions/${sessionId}`, {
        method: "POST",
        body: JSON.stringify({ command }),
      });
      setSelectedBrowserSessionId(sessionId);
      setBrowserCommand("");
      toast.success("Browser command sent.");
      await loadData();
    } catch (commandError) {
      toast.error(commandError instanceof Error ? commandError.message : "Browser command failed.");
    } finally {
      setSaving(null);
    }
  }

  async function createChannelConnection() {
    setSaving("channel");
    try {
      await authFetch("/api/work/channels", {
        method: "POST",
        body: JSON.stringify(channelForm),
      });
      toast.success("Channel connection saved.");
      setChannelForm(emptyChannelForm);
      await loadData();
    } catch (channelError) {
      toast.error(channelError instanceof Error ? channelError.message : "Channel save failed.");
    } finally {
      setSaving(null);
    }
  }

  async function testChannelConnection(connectionId: string) {
    setSaving(`channel-test:${connectionId}`);
    try {
      await authFetch(`/api/work/channels/${connectionId}/test`, { method: "POST" });
      toast.success("Channel health checked.");
      await loadData();
    } catch (channelError) {
      toast.error(channelError instanceof Error ? channelError.message : "Channel test failed.");
    } finally {
      setSaving(null);
    }
  }

  async function deleteChannelConnection(connectionId: string) {
    setSaving(`channel-delete:${connectionId}`);
    try {
      await authFetch(`/api/work/channels/${connectionId}`, { method: "DELETE" });
      toast.success("Channel connection deleted.");
      await loadData();
    } catch (channelError) {
      toast.error(channelError instanceof Error ? channelError.message : "Channel delete failed.");
    } finally {
      setSaving(null);
    }
  }

  async function createPairingToken() {
    setSaving("pairing-token");
    try {
      const payload = await authFetch("/api/work/pairing", {
        method: "POST",
        body: JSON.stringify({ action: "create-token", label: "Desktop runtime" }),
      });
      setLastPairingCode(getPayloadString(payload, "code"));
      toast.success("Pairing code created.");
      await loadData();
    } catch (pairingError) {
      toast.error(pairingError instanceof Error ? pairingError.message : "Pairing token failed.");
    } finally {
      setSaving(null);
    }
  }

  async function claimPairingToken() {
    if (!pairingCode.trim()) return;
    setSaving("pairing-claim");
    try {
      await authFetch("/api/work/pairing", {
        method: "POST",
        body: JSON.stringify({
          action: "claim",
          code: pairingCode,
          deviceName: "Rearvy Desktop",
          deviceType: "desktop",
          capabilities: ["browser", "desktop_workflow", "terminal"],
        }),
      });
      setPairingCode("");
      toast.success("Desktop device paired.");
      await loadData();
    } catch (pairingError) {
      toast.error(pairingError instanceof Error ? pairingError.message : "Pairing claim failed.");
    } finally {
      setSaving(null);
    }
  }

  async function createSourceTask() {
    if (!sourceForm.query.trim()) return;
    setSaving("source");
    try {
      await authFetch("/api/work/sources", {
        method: "POST",
        body: JSON.stringify(sourceForm),
      });
      toast.success("Source research task created.");
      setSourceForm(emptySourceForm);
      await loadData();
    } catch (sourceError) {
      toast.error(sourceError instanceof Error ? sourceError.message : "Source task failed.");
    } finally {
      setSaving(null);
    }
  }

  async function updateSourceTask(taskId: string, action: "approve" | "reject" | "run") {
    setSaving(`source:${taskId}:${action}`);
    try {
      await authFetch(`/api/work/sources/${taskId}/run`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      toast.success(action === "reject" ? "Source task rejected." : "Source task running.");
      await loadData();
    } catch (sourceError) {
      toast.error(sourceError instanceof Error ? sourceError.message : "Source task update failed.");
    } finally {
      setSaving(null);
    }
  }

  async function createProcess() {
    if (!processForm.command.trim()) return;
    setSaving("process");
    try {
      await authFetch("/api/work/processes", {
        method: "POST",
        body: JSON.stringify(processForm),
      });
      toast.success("Process queued.");
      setProcessForm(emptyProcessForm);
      await loadData();
    } catch (processError) {
      toast.error(processError instanceof Error ? processError.message : "Process queue failed.");
    } finally {
      setSaving(null);
    }
  }

  async function approveProcess(processId: string) {
    setSaving(`process-approve:${processId}`);
    try {
      await authFetch(`/api/work/processes/${processId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "approve" }),
      });
      toast.success("Process approved.");
      await loadData();
    } catch (processError) {
      toast.error(processError instanceof Error ? processError.message : "Process approval failed.");
    } finally {
      setSaving(null);
    }
  }

  async function stopProcess(processId: string) {
    setSaving(`process-stop:${processId}`);
    try {
      await authFetch(`/api/work/processes/${processId}/stop`, { method: "POST" });
      toast.success("Stop requested.");
      await loadData();
    } catch (processError) {
      toast.error(processError instanceof Error ? processError.message : "Process stop failed.");
    } finally {
      setSaving(null);
    }
  }

  async function sendProcessInput(processId: string) {
    if (!processInput.trim()) return;
    setSaving(`process-input:${processId}`);
    try {
      await authFetch(`/api/work/processes/${processId}/input`, {
        method: "POST",
        body: JSON.stringify({ text: processInput }),
      });
      setProcessInput("");
      toast.success("Input queued.");
      await loadData();
    } catch (processError) {
      toast.error(processError instanceof Error ? processError.message : "Process input failed.");
    } finally {
      setSaving(null);
    }
  }

  async function searchMemories() {
    setSaving("memory-search");
    try {
      const payload = await authFetch(`/api/work/memory/search?q=${encodeURIComponent(memoryQuery)}&limit=30`);
      setMemories(getPayloadArray<MemoryRecord>(payload, "memories"));
    } catch (memoryError) {
      toast.error(memoryError instanceof Error ? memoryError.message : "Memory search failed.");
    } finally {
      setSaving(null);
    }
  }

  async function createDiary() {
    setSaving("diary");
    try {
      await authFetch("/api/work/diary", {
        method: "POST",
        body: JSON.stringify({ entryDate: diaryDate || undefined }),
      });
      toast.success("Diary entry generated.");
      await loadData();
    } catch (diaryError) {
      toast.error(diaryError instanceof Error ? diaryError.message : "Diary generation failed.");
    } finally {
      setSaving(null);
    }
  }

  async function updateWorkRun(runId: string, action: "approve" | "reject") {
    setSaving(`work-run:${runId}:${action}`);
    try {
      await authFetch(`/api/work/runs/${runId}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      toast.success(action === "approve" ? "Work run approved." : "Work run rejected.");
      await loadData();
    } catch (runError) {
      toast.error(runError instanceof Error ? runError.message : "Run update failed.");
    } finally {
      setSaving(null);
    }
  }

  const selectedSession = browserSessions.find((session) => session.id === selectedBrowserSessionId);
  const isDirectIntegrationView =
    initialView === "integrations" && activeView === "integrations";

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 pb-8">
      {!isDirectIntegrationView ? (
        <div className="flex gap-1 overflow-x-auto rounded-[8px] border bg-card/90 p-1 shadow-sm backdrop-blur">
          {WORK_VIEWS.map((view) => {
            const Icon = view.icon;
            return (
              <button
                key={view.id}
                type="button"
                onClick={() => setActiveView(view.id)}
                className={cn(
                  "flex h-10 shrink-0 items-center gap-2 rounded-[7px] px-3 text-sm font-medium transition-colors",
                  activeView === view.id
                    ? "bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {view.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {activeView === "overview" ? (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard label="Integrations" value={summary?.counts?.integrations ?? 0} icon={Plug} />
            <MetricCard label="Memory" value={memories.length} icon={Brain} />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {[
              ["Integrations", summary?.readiness?.connectors ? "connected" : "setup", Plug],
              ["Memory", memories.length > 0 ? "active" : "ready", Brain],
            ].map(([label, status, Icon]) => (
              <Card key={String(label)} className={WORK_CARD_INTERACTIVE_CLASS}>
                <CardContent className="flex min-h-[88px] items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-[8px] border bg-background text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="font-medium">{String(label)}</span>
                  </div>
                  <Badge variant={statusVariant(String(status))}>{String(status)}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {activeView === "skills" ? (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <MetricCard
              label="Capability groups"
              value={new Set(BUILT_IN_ABILITY_TEMPLATES.map((ability) => ability.category)).size}
              icon={ShieldCheck}
            />
            <MetricCard
              label="Built-in skills"
              value={BUILT_IN_ABILITY_TEMPLATES.length}
              icon={BookOpen}
            />
            <MetricCard
              label="Tool mappings"
              value={BUILT_IN_ABILITY_TEMPLATES.reduce(
                (count, ability) => count + ability.capabilities.length,
                0
              )}
              icon={Workflow}
            />
          </div>

          {Array.from(new Set(BUILT_IN_ABILITY_TEMPLATES.map((ability) => ability.category))).map(
            (category) => {
              const Icon = ABILITY_CATEGORY_ICONS[category] ?? ShieldCheck;
              const abilities = BUILT_IN_ABILITY_TEMPLATES.filter(
                (ability) => ability.category === category
              );

              return (
                <section key={category} className="space-y-3">
                  <SectionTitle icon={Icon} title={category} />
                  <div className="grid gap-3 lg:grid-cols-2">
                    {abilities.map((ability) => (
                      <AbilityTemplateCard key={ability.id} ability={ability} />
                    ))}
                  </div>
                </section>
              );
            }
          )}
        </div>
      ) : null}

      {activeView === "automations" ? (
        <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
          <Card className={WORK_CARD_CLASS}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Workflow className="h-4 w-4" />
                New Automation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Name" value={automationForm.name} onChange={(event) => setAutomationForm({ ...automationForm, name: event.target.value })} />
              <Textarea className="min-h-28" placeholder="Task" value={automationForm.task} onChange={(event) => setAutomationForm({ ...automationForm, task: event.target.value })} />
              <select className={WORK_FORM_CONTROL_CLASS} value={automationForm.schedule} onChange={(event) => setAutomationForm({ ...automationForm, schedule: event.target.value })}>
                <option value="weekdays">Weekdays</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="hourly">Hourly</option>
              </select>
              <select className={WORK_FORM_CONTROL_CLASS} value={automationForm.runTarget} onChange={(event) => setAutomationForm({ ...automationForm, runTarget: event.target.value })}>
                <option value="browser">Browser</option>
                <option value="python">Python</option>
                <option value="sync">Sync</option>
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={automationForm.autoExecuteEnabled} onChange={(event) => setAutomationForm({ ...automationForm, autoExecuteEnabled: event.target.checked, trustedScope: event.target.checked ? "trusted" : "none" })} />
                Trusted auto-execution
              </label>
              <Button type="button" onClick={() => void createAutomation()} disabled={saving === "automation"}>
                {saving === "automation" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Save Automation
              </Button>
            </CardContent>
          </Card>
          <div className="space-y-3">
            <SectionTitle icon={Workflow} title="Scheduled Automations" />
            {automations.map((automation) => (
              <Card key={automation.id} className={WORK_CARD_INTERACTIVE_CLASS}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{automation.name}</div>
                      <div className="max-w-2xl text-sm text-muted-foreground">{automation.task}</div>
                    </div>
                    <Badge variant={automation.is_enabled ? "default" : "secondary"}>{automation.schedule_label}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span>{automation.run_target}</span>
                    <span>{automation.auto_execute_enabled ? `trusted: ${automation.trusted_scope || "none"}` : "approval gated"}</span>
                    <span>Last run: {formatTime(automation.last_run_at)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => void runAutomation(automation.id)} disabled={saving === `run:${automation.id}`}>
                      {saving === `run:${automation.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      Run
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void deleteAutomation(automation.id)} disabled={saving === `delete-automation:${automation.id}`}>
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {activeView === "listeners" ? (
        <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
          <Card className={WORK_CARD_CLASS}>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Bell className="h-4 w-4" />Create Listener</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Listener name" value={listenerForm.name} onChange={(event) => setListenerForm({ ...listenerForm, name: event.target.value })} />
              <select className={WORK_FORM_CONTROL_CLASS} value={listenerForm.provider} onChange={(event) => setListenerForm({ ...listenerForm, provider: event.target.value })}>
                <option value="source">Source monitor</option>
                <option value="gmail">Gmail replies</option>
                <option value="channel">Channel messages</option>
                <option value="webhook">Webhook trigger</option>
              </select>
              {listenerForm.provider === "source" ? (
                <select className={WORK_FORM_CONTROL_CLASS} value={listenerForm.sourceProvider} onChange={(event) => setListenerForm({ ...listenerForm, sourceProvider: event.target.value })}>
                  {sourceCatalog.map((source) => (
                    <option key={source.provider} value={source.provider}>{source.label}</option>
                  ))}
                </select>
              ) : null}
              <Textarea className="min-h-24" placeholder="Query or match phrase" value={listenerForm.query} onChange={(event) => setListenerForm({ ...listenerForm, query: event.target.value })} />
              <select className={WORK_FORM_CONTROL_CLASS} value={listenerForm.schedule} onChange={(event) => setListenerForm({ ...listenerForm, schedule: event.target.value })}>
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekdays">Weekdays</option>
                <option value="weekly">Weekly</option>
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={listenerForm.autoExecuteEnabled} onChange={(event) => setListenerForm({ ...listenerForm, autoExecuteEnabled: event.target.checked, trustedScope: event.target.checked ? "trusted" : "none" })} />
                Trusted scheduled execution
              </label>
              <Button type="button" onClick={() => void createListener()} disabled={!listenerForm.query.trim() || saving === "listener"}>
                {saving === "listener" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Save Listener
              </Button>
            </CardContent>
          </Card>
          <div className="space-y-3">
            <SectionTitle icon={Bell} title="Listeners" />
            {listeners.length === 0 ? (
              <WorkEmptyState
                icon={Bell}
                title="No listeners configured"
                detail="Add a listener to watch source signals, inbox replies, channel updates, or webhook events before they become actions."
                tone="amber"
              />
            ) : null}
            {listeners.map((listener) => (
              <Card key={listener.id} className={WORK_CARD_INTERACTIVE_CLASS}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{listener.name}</div>
                      <div className="max-w-2xl text-sm text-muted-foreground">{listener.query}</div>
                    </div>
                    <Badge variant={statusVariant(listener.status)}>{listener.status}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span>{listener.provider}</span>
                    <span>{listener.schedule_label}</span>
                    <span>{listener.auto_execute_enabled ? `trusted: ${listener.trusted_scope}` : "manual run"}</span>
                    <span>{listener.match_count} matches</span>
                    <span>Next: {formatTime(listener.next_run_at)}</span>
                  </div>
                  {listener.error ? <div className="text-sm text-red-600">{listener.error}</div> : null}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => void runListener(listener.id)} disabled={saving === `listener-run:${listener.id}`}>
                      {saving === `listener-run:${listener.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      Run
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void deleteListener(listener.id)} disabled={saving === `listener-delete:${listener.id}`}>
                      <Trash2 className="h-4 w-4" />
                      Archive
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {activeView === "browser" ? (
        <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
          <Card className={WORK_CARD_CLASS}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe2 className="h-4 w-4" />
                Browser Task
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea className="min-h-32" placeholder="Research a site, extract a table, or inspect a dashboard" value={browserTask} onChange={(event) => setBrowserTask(event.target.value)} />
              <Button type="button" onClick={() => void startBrowserSession()} disabled={saving === "browser" || !browserTask.trim()}>
                {saving === "browser" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Start
              </Button>
              <div className={cn(WORK_INLINE_PANEL_CLASS, "px-3 py-2 text-xs text-muted-foreground")}>
                Hosted sessions use the Browserbase cloud browser when configured; desktop/dev sessions keep using the local browser-use runner.
              </div>
            </CardContent>
          </Card>
          <div className="space-y-3">
            <SectionTitle icon={Globe2} title="Browser Sessions" />
            {browserSessions.length === 0 ? (
              <WorkEmptyState
                icon={Laptop}
                title="No active browser sessions"
                detail="Start a browser task to research a site, extract structured data, or inspect a dashboard with a visible session trail."
                tone="emerald"
              />
            ) : null}
            {browserSessions.map((session) => (
              <Card key={session.id} className={WORK_CARD_INTERACTIVE_CLASS}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{session.title || session.task}</div>
                      <div className="truncate text-sm text-muted-foreground">{session.currentUrl || session.summary || session.task}</div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      <Badge variant={session.connectionMethod === "cloud-browser" ? "default" : "secondary"}>
                        {session.connectionMethod === "cloud-browser" ? "cloud" : "local"}
                      </Badge>
                      <Badge variant={statusVariant(session.status)}>{session.status || (session.isRunning ? "running" : "closed")}</Badge>
                    </div>
                  </div>
                  {session.setupError ? <div className="rounded-[8px] border border-red-200 bg-red-50 p-2 text-sm text-red-700">{session.setupError}</div> : null}
                  {session.connectionMethod === "cloud-browser" ? (
                    <div className="rounded-[8px] border border-border/70 bg-background/70 p-2 text-xs text-muted-foreground">
                      <div className="font-medium text-foreground">Cloud files</div>
                      {session.files?.length ? (
                        <div className="mt-1 flex flex-wrap gap-2">
                          {session.files.slice(0, 4).map((file) => {
                            const downloadUrl = file.downloadUrl
                              ? normalizeHttpUrl(file.downloadUrl)
                              : null;

                            return (
                              <a
                                key={file.id}
                                href={downloadUrl || "#"}
                                target={downloadUrl ? "_blank" : undefined}
                                rel={downloadUrl ? "noopener noreferrer" : undefined}
                                aria-disabled={!downloadUrl}
                                className={cn(
                                  "rounded-[8px] border border-border/70 px-2 py-1 hover:bg-muted",
                                  !downloadUrl && "pointer-events-none opacity-60"
                                )}
                              >
                                {file.filename}
                              </a>
                            );
                          })}
                        </div>
                      ) : (
                        <WorkEmptyState
                          compact
                          icon={Laptop}
                          title="No synced files"
                          detail="Downloads from this cloud browser session will appear here."
                          tone="slate"
                        />
                      )}
                    </div>
                  ) : null}
                  {session.awaitingApproval ? (
                    <div className="rounded-[8px] border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">
                      {session.awaitingApproval.reason || "Approval required"}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant={selectedBrowserSessionId === session.id ? "default" : "outline"} onClick={() => setSelectedBrowserSessionId(session.id)}>
                      Select
                    </Button>
                    {session.awaitingApproval ? (
                      <Button type="button" size="sm" onClick={() => void sendBrowserCommand(session.awaitingApproval?.id ? `approve:${session.awaitingApproval.id}` : "approve", session.id)}>
                        <CheckCircle2 className="h-4 w-4" />
                        Approve
                      </Button>
                    ) : null}
                    <Button type="button" size="sm" variant="outline" onClick={() => void sendBrowserCommand("stop", session.id)}>
                      <XCircle className="h-4 w-4" />
                      Stop
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Card className={WORK_CARD_CLASS}>
              <CardContent className="space-y-3 p-4">
                <div className="text-sm font-medium">Follow-up Command</div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select className={cn(WORK_FORM_CONTROL_CLASS, "sm:w-64")} value={selectedBrowserSessionId} onChange={(event) => setSelectedBrowserSessionId(event.target.value)}>
                    <option value="">Select session</option>
                    {browserSessions.map((session) => (
                      <option key={session.id} value={session.id}>{session.title || session.task.slice(0, 40)}</option>
                    ))}
                  </select>
                  <Input value={browserCommand} onChange={(event) => setBrowserCommand(event.target.value)} placeholder={selectedSession ? "Click, extract, navigate, or summarize" : "Select a session"} />
                  <Button type="button" onClick={() => void sendBrowserCommand(browserCommand)} disabled={!selectedBrowserSessionId || !browserCommand.trim() || saving === "browser-command"}>
                    {saving === "browser-command" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Send
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {activeView === "integrations" ? (
        <IntegrationsPanel basePath="/work/integrations" embedded />
      ) : null}

      {activeView === "channels" ? (
        <div className="space-y-5">
          <SectionTitle icon={Radio} title="Channels And Pairing" />
          <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
            <div className="space-y-3">
              <Card className={WORK_CARD_CLASS}>
                <CardHeader><CardTitle className="text-base">Connect Channel</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <select className={WORK_FORM_CONTROL_CLASS} value={channelForm.provider} onChange={(event) => setChannelForm({ ...channelForm, provider: event.target.value })}>
                    {channels.map((channel) => (
                      <option key={channel.provider} value={channel.provider}>{channel.label}</option>
                    ))}
                  </select>
                  <Input placeholder="Label" value={channelForm.label} onChange={(event) => setChannelForm({ ...channelForm, label: event.target.value })} />
                  <Input placeholder="Channel, chat, or recipient ID" value={channelForm.externalChannelId} onChange={(event) => setChannelForm({ ...channelForm, externalChannelId: event.target.value })} />
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={channelForm.autoReplyEnabled} onChange={(event) => setChannelForm({ ...channelForm, autoReplyEnabled: event.target.checked, trustedScope: event.target.checked ? "trusted" : "none" })} />
                    Trusted auto-reply
                  </label>
                  <Button type="button" onClick={() => void createChannelConnection()} disabled={saving === "channel"}>
                    {saving === "channel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Save Connection
                  </Button>
                </CardContent>
              </Card>
              <Card className={WORK_CARD_CLASS}>
                <CardHeader><CardTitle className="text-base">Pair Desktop</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => void createPairingToken()} disabled={saving === "pairing-token"}>
                      {saving === "pairing-token" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                      New Code
                    </Button>
                    {lastPairingCode ? <Badge variant="default">{lastPairingCode}</Badge> : null}
                  </div>
                  <div className="flex gap-2">
                    <Input placeholder="Pairing code" value={pairingCode} onChange={(event) => setPairingCode(event.target.value)} />
                    <Button type="button" onClick={() => void claimPairingToken()} disabled={!pairingCode.trim() || saving === "pairing-claim"}>
                      Claim
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Current device: {String(pairing?.currentDevice?.status || "web session")}
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="space-y-3">
              <div className="grid gap-3 lg:grid-cols-2">
                {channels.map((channel) => (
                  <Card key={channel.provider} className={WORK_CARD_INTERACTIVE_CLASS}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div>
                        <div className="font-medium">{channel.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {(channel.requiredCredentials || []).join(", ") || "env-backed"}
                        </div>
                      </div>
                      <Badge variant={statusVariant(channel.status)}>{channel.status}</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card className={WORK_CARD_CLASS}>
                <CardHeader><CardTitle className="text-base">Connections</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {channelConnections.length === 0 ? (
                    <WorkEmptyState
                      compact
                      icon={Radio}
                      title="No channel connections"
                      detail="Save a channel connection before testing or approving outbound replies."
                      tone="slate"
                    />
                  ) : null}
                  {channelConnections.map((connection) => (
                    <div key={connection.id} className={cn(WORK_INLINE_PANEL_CLASS, "flex flex-wrap items-center justify-between gap-3 px-3 py-2")}>
                      <div>
                        <div className="text-sm font-medium">{connection.label}</div>
                        <div className="text-xs text-muted-foreground">{connection.provider} / {connection.external_channel_id || "no external id"} / {connection.auto_reply_enabled ? `trusted: ${connection.trusted_scope || "none"}` : "approval gated"}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusVariant(connection.status)}>{connection.status}</Badge>
                        <Button size="sm" variant="outline" onClick={() => void testChannelConnection(connection.id)} disabled={saving === `channel-test:${connection.id}`}>Test</Button>
                        <Button size="icon" variant="ghost" onClick={() => void deleteChannelConnection(connection.id)} disabled={saving === `channel-delete:${connection.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card className={WORK_CARD_CLASS}>
                <CardHeader><CardTitle className="text-base">Paired Devices</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {(pairing?.devices || []).length === 0 ? (
                    <WorkEmptyState
                      compact
                      icon={ShieldCheck}
                      title="No paired desktop devices"
                      detail="Create a pairing code when the desktop runtime is ready to claim this workspace."
                      tone="slate"
                    />
                  ) : null}
                  {(pairing?.devices || []).map((device) => (
                    <div key={device.id} className={cn(WORK_INLINE_PANEL_CLASS, "flex items-center justify-between px-3 py-2")}>
                      <div>
                        <div className="text-sm font-medium">{device.device_name}</div>
                        <div className="text-xs text-muted-foreground">Last seen {formatTime(device.last_seen_at)}</div>
                      </div>
                      <Badge variant={statusVariant(device.status)}>{device.status}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      ) : null}

      {activeView === "sources" ? (
        <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
          <Card className={WORK_CARD_CLASS}>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Globe2 className="h-4 w-4" />Source Research</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <select className={WORK_FORM_CONTROL_CLASS} value={sourceForm.provider} onChange={(event) => setSourceForm({ ...sourceForm, provider: event.target.value })}>
                {sourceCatalog.map((source) => (
                  <option key={source.provider} value={source.provider}>{source.label}</option>
                ))}
              </select>
              <Textarea className="min-h-28" placeholder="Supplier, audience, trend, competitor, or product source query" value={sourceForm.query} onChange={(event) => setSourceForm({ ...sourceForm, query: event.target.value })} />
              <Button type="button" onClick={() => void createSourceTask()} disabled={!sourceForm.query.trim() || saving === "source"}>
                {saving === "source" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Start Research
              </Button>
            </CardContent>
          </Card>
          <div className="space-y-3">
            <SectionTitle icon={Globe2} title="Source Tasks" />
            <div className="grid gap-3 lg:grid-cols-2">
              {sourceCatalog.map((source) => (
                <Card key={source.provider} className={WORK_CARD_INTERACTIVE_CLASS}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <div className="font-medium">{source.label}</div>
                      <div className="text-xs text-muted-foreground">{source.mode}</div>
                    </div>
                    <Badge variant={statusVariant(source.status)}>{source.status}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
            {sourceTasks.length === 0 ? (
              <WorkEmptyState
                icon={Globe2}
                title="No source research tasks yet"
                detail="Start a research task to track suppliers, competitors, trends, or audience signals from the connected source catalog."
                tone="emerald"
              />
            ) : null}
            {sourceTasks.map((task) => (
              <Card key={task.id} className={WORK_CARD_INTERACTIVE_CLASS}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{task.query}</div>
                      <div className="text-sm text-muted-foreground">{task.provider} / {task.mode} / {formatTime(task.created_at)}</div>
                    </div>
                    <Badge variant={statusVariant(task.status)}>{task.status}</Badge>
                  </div>
                  {task.error ? <div className="text-sm text-red-600">{task.error}</div> : null}
                  <div className="flex flex-wrap gap-2">
                    {task.status === "awaiting_approval" ? (
                      <>
                        <Button size="sm" onClick={() => void updateSourceTask(task.id, "approve")} disabled={saving === `source:${task.id}:approve`}>
                          <CheckCircle2 className="h-4 w-4" />
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void updateSourceTask(task.id, "reject")} disabled={saving === `source:${task.id}:reject`}>
                          <XCircle className="h-4 w-4" />
                          Reject
                        </Button>
                      </>
                    ) : null}
                    {task.status === "queued" || task.status === "failed" ? (
                      <Button size="sm" variant="outline" onClick={() => void updateSourceTask(task.id, "run")} disabled={saving === `source:${task.id}:run`}>
                        <Play className="h-4 w-4" />
                        Run
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
            {sourceCandidates.length > 0 ? (
              <Card className={WORK_CARD_CLASS}>
                <CardHeader><CardTitle className="text-base">Recent Candidates</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {sourceCandidates.slice(0, 8).map((candidate) => (
                    <div key={candidate.id} className={cn(WORK_INLINE_PANEL_CLASS, "px-3 py-2")}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="truncate text-sm font-medium">{candidate.title}</div>
                        <Badge variant="secondary">{candidate.provider}</Badge>
                      </div>
                      <div className="line-clamp-2 text-xs text-muted-foreground">{candidate.summary || candidate.url || "No summary"}</div>
                      {(candidate.price || candidate.moq || candidate.supplier) ? (
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {candidate.supplier ? <span>{candidate.supplier}</span> : null}
                          {candidate.price ? <span>{candidate.price}</span> : null}
                          {candidate.moq ? <span>{candidate.moq}</span> : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      ) : null}

      {activeView === "memory" ? (
        <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
          <div className="space-y-3">
            <Card className={WORK_CARD_CLASS}>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Brain className="h-4 w-4" />Memory Search</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input placeholder="Search memory" value={memoryQuery} onChange={(event) => setMemoryQuery(event.target.value)} />
                  <Button type="button" onClick={() => void searchMemories()} disabled={saving === "memory-search"}>
                    {saving === "memory-search" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card className={WORK_CARD_CLASS}>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4" />Diary</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input type="date" value={diaryDate} onChange={(event) => setDiaryDate(event.target.value)} />
                <Button type="button" onClick={() => void createDiary()} disabled={saving === "diary"}>
                  {saving === "diary" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Generate Entry
                </Button>
              </CardContent>
            </Card>
            <Card className={WORK_CARD_CLASS}>
              <CardHeader><CardTitle className="text-base">Context</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>Time: {workContext?.time?.local || "Unknown"}</div>
                <div>Timezone: {workContext?.time?.timezone || "UTC"}</div>
                <div>Location: {[workContext?.location?.city, workContext?.location?.region, workContext?.location?.country].filter(Boolean).join(", ") || "Unavailable"}</div>
                <div>Weather: {String(workContext?.weather?.status || "unavailable")}</div>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-3">
            <SectionTitle icon={Brain} title="Memory And Diary" />
            <div className="grid gap-3 lg:grid-cols-2">
              {memories.map((memory) => (
                <Card key={memory.id} className={WORK_CARD_INTERACTIVE_CLASS}>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <Badge variant="secondary">{memory.memory_type || "memory"}</Badge>
                      <span className="text-xs text-muted-foreground">{formatTime(memory.updated_at)}</span>
                    </div>
                    <div className="line-clamp-3 text-sm">{memory.content || "Empty memory"}</div>
                    {memory.tags?.length ? <div className="text-xs text-muted-foreground">{memory.tags.join(", ")}</div> : null}
                  </CardContent>
                </Card>
              ))}
            </div>
            {diaryEntries.map((entry) => (
              <Card key={entry.id} className={WORK_CARD_INTERACTIVE_CLASS}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="font-semibold">{entry.title}</div>
                    <Badge variant="secondary">{entry.entry_date}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">{entry.summary}</div>
                  {entry.highlights.length ? <div className="text-xs text-muted-foreground">{entry.highlights.join(" / ")}</div> : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {activeView === "processes" ? (
        <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
          <Card className={WORK_CARD_CLASS}>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Terminal className="h-4 w-4" />Queue Process</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Textarea className="min-h-28 font-mono" placeholder="Command" value={processForm.command} onChange={(event) => setProcessForm({ ...processForm, command: event.target.value })} />
              <Input placeholder="Working directory" value={processForm.cwd} onChange={(event) => setProcessForm({ ...processForm, cwd: event.target.value })} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={processForm.autoExecuteEnabled} onChange={(event) => setProcessForm({ ...processForm, autoExecuteEnabled: event.target.checked, trustedScope: event.target.checked ? "trusted" : "none" })} />
                Trusted local execution
              </label>
              <Button type="button" onClick={() => void createProcess()} disabled={!processForm.command.trim() || saving === "process"}>
                {saving === "process" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Queue Process
              </Button>
            </CardContent>
          </Card>
          <div className="space-y-3">
            <SectionTitle icon={Terminal} title="Process Sessions" />
            {processes.length === 0 ? (
              <WorkEmptyState
                icon={Terminal}
                title="No process sessions yet"
                detail="Queue a local command when the desktop runtime should execute work behind an approval gate."
                tone="amber"
              />
            ) : null}
            {processes.map((processSession) => (
              <Card key={processSession.id} className={WORK_CARD_INTERACTIVE_CLASS}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-mono text-sm font-semibold">{processSession.command}</div>
                      <div className="text-xs text-muted-foreground">{processSession.cwd || "default cwd"} / {processSession.local_job_id || "not claimed"}</div>
                    </div>
                    <Badge variant={statusVariant(processSession.status)}>{processSession.status}</Badge>
                  </div>
                  {processSession.error ? <div className="text-sm text-red-600">{processSession.error}</div> : null}
                  <div className="rounded-[8px] bg-muted p-3 font-mono text-xs">
                    {(processSession.stdout || []).slice(-4).map((line, index) => <div key={`out-${processSession.id}-${index}`}>{line}</div>)}
                    {(processSession.stderr || []).slice(-4).map((line, index) => <div key={`err-${processSession.id}-${index}`} className="text-red-600">{line}</div>)}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {processSession.status === "queued" ? (
                      <Button size="sm" onClick={() => void approveProcess(processSession.id)} disabled={saving === `process-approve:${processSession.id}`}>
                        <CheckCircle2 className="h-4 w-4" />
                        Approve
                      </Button>
                    ) : null}
                    {processSession.status === "running" ? (
                      <>
                        <Input className="max-w-sm" placeholder="stdin" value={processInput} onChange={(event) => setProcessInput(event.target.value)} />
                        <Button size="sm" variant="outline" onClick={() => void sendProcessInput(processSession.id)} disabled={saving === `process-input:${processSession.id}`}>Send</Button>
                        <Button size="sm" variant="outline" onClick={() => void stopProcess(processSession.id)} disabled={saving === `process-stop:${processSession.id}`}>
                          <XCircle className="h-4 w-4" />
                          Stop
                        </Button>
                      </>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {activeView === "runs" ? (
        <div className="space-y-3">
          <SectionTitle icon={ShieldCheck} title="Runs And Approvals" />
          {runs.length === 0 ? (
            <WorkEmptyState
              icon={ShieldCheck}
              title="No runs recorded yet"
              detail="Completed automations, approval decisions, failures, and queued work history will appear here once work starts."
              tone="slate"
            />
          ) : null}
          {runs.map((run) => (
            <Card key={`${run.source}:${run.id}`} className={WORK_CARD_INTERACTIVE_CLASS}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="truncate font-medium">{run.task || run.trigger_type || run.trigger || run.id}</div>
                  <div className="text-sm text-muted-foreground">{run.source} / {formatTime(run.created_at)}</div>
                  {run.error ? <div className="text-sm text-red-600">{run.error}</div> : null}
                </div>
                <div className="flex items-center gap-2">
                  {run.source === "work_automation" && run.status === "awaiting_approval" ? (
                    <>
                      <Button size="sm" onClick={() => void updateWorkRun(run.id, "approve")} disabled={saving === `work-run:${run.id}:approve`}>
                        <CheckCircle2 className="h-4 w-4" />
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void updateWorkRun(run.id, "reject")} disabled={saving === `work-run:${run.id}:reject`}>
                        <XCircle className="h-4 w-4" />
                        Reject
                      </Button>
                    </>
                  ) : null}
                  <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
