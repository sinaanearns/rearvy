"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ElementType, type ReactNode } from "react";
import {
  Activity,
  Bot,
  CheckCircle2,
  Globe2,
  Laptop,
  Loader2,
  MessageSquare,
  Play,
  Plug,
  Plus,
  Puzzle,
  Radio,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  Users,
  Workflow,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { McpServersSection } from "@/components/work/mcp-servers-section";
import { getIdToken } from "@/lib/firebase/auth";
import { cn } from "@/lib/utils";

const IntegrationsPanel = dynamic(
  () =>
    import("@/components/integrations/integrations-panel").then(
      (mod) => mod.IntegrationsPanel
    ),
  {
    loading: () => (
      <div className="rounded-lg border px-4 py-3 text-sm text-muted-foreground">
        Loading integrations...
      </div>
    ),
  }
);

type WorkView =
  | "overview"
  | "agents"
  | "automations"
  | "browser"
  | "integrations"
  | "skills"
  | "teams"
  | "channels"
  | "sources"
  | "runs";

type WorkAgent = {
  id: string;
  name: string;
  short_label: string;
  summary: string;
  role: string;
  instructions: string;
  capability_preset: "standard" | "full" | "minimal" | "team_lead";
  installed_skill_ids: string[];
  memory_enabled: boolean;
  source: "built_in" | "custom";
  model_id: string | null;
};

type WorkAutomation = {
  id: string;
  name: string;
  task: string;
  schedule: string;
  schedule_label: string;
  run_target: string;
  agent_id: string | null;
  approval_required: boolean;
  is_enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
};

type BrowserSession = {
  id: string;
  task: string;
  createdAt: number;
  isRunning: boolean;
  status?: string;
  currentUrl?: string | null;
  title?: string | null;
  summary?: string | null;
  setupError?: string | null;
  awaitingApproval?: { id?: string; reason?: string } | null;
  stdout?: string[];
  stderr?: string[];
  actionLog?: Array<{ id: string; action: string; status: string; message: string; timestamp: string }>;
};

type SkillTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  defaultScope: "account" | "agent";
  capabilities: string[];
};

type InstalledSkill = {
  id: string;
  name: string;
  description: string;
  scope: "account" | "agent";
  agent_id: string | null;
  source: "built_in" | "mcp";
};

type McpServer = {
  id: string;
  name: string;
  type: "stdio" | "sse";
  is_active: boolean;
};

type WorkTeam = {
  id: string;
  name: string;
  description: string | null;
  lead_agent_id: string;
  mode: string;
  members?: Array<{ id: string; agent_id: string; role: string }>;
  is_active: boolean;
};

type WorkRun = {
  id: string;
  source: string;
  status: string;
  task?: string;
  trigger_type?: string;
  trigger?: string;
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
  { id: "agents", label: "Agents", icon: Bot },
  { id: "automations", label: "Automations", icon: Workflow },
  { id: "browser", label: "Browser", icon: Globe2 },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "skills", label: "Skills", icon: Puzzle },
  { id: "teams", label: "Teams", icon: Users },
  { id: "channels", label: "Channels", icon: Radio },
  { id: "sources", label: "Sources", icon: Globe2 },
  { id: "runs", label: "Runs", icon: ShieldCheck },
];

const emptyAgentForm = {
  id: "",
  name: "",
  summary: "",
  role: "",
  instructions: "",
  capabilityPreset: "standard",
};

const emptyAutomationForm = {
  name: "",
  task: "",
  schedule: "weekdays",
  runTarget: "agent",
  agentId: "",
};

const emptyTeamForm = {
  name: "",
  description: "",
  leadAgentId: "",
};

const emptyChannelForm = {
  provider: "telegram",
  label: "",
  externalChannelId: "",
  autoReplyEnabled: false,
};

const emptySourceForm = {
  provider: "reddit",
  query: "",
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
        <Icon className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {action}
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
    <Card className="rounded-lg">
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <div className="text-2xl font-semibold">{value}</div>
          <div className="text-sm text-muted-foreground">{label}</div>
        </div>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardContent>
    </Card>
  );
}

export function WorkPlatform({ initialView = "overview" }: WorkPlatformProps) {
  const [activeView, setActiveView] = useState<WorkView>(initialView);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [agents, setAgents] = useState<WorkAgent[]>([]);
  const [automations, setAutomations] = useState<WorkAutomation[]>([]);
  const [browserSessions, setBrowserSessions] = useState<BrowserSession[]>([]);
  const [skillCatalog, setSkillCatalog] = useState<SkillTemplate[]>([]);
  const [installedSkills, setInstalledSkills] = useState<InstalledSkill[]>([]);
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [teams, setTeams] = useState<WorkTeam[]>([]);
  const [runs, setRuns] = useState<WorkRun[]>([]);
  const [channels, setChannels] = useState<ChannelCatalogItem[]>([]);
  const [channelConnections, setChannelConnections] = useState<ChannelConnection[]>([]);
  const [pairing, setPairing] = useState<PairingState | null>(null);
  const [sourceCatalog, setSourceCatalog] = useState<SourceCatalogItem[]>([]);
  const [sourceTasks, setSourceTasks] = useState<SourceTask[]>([]);
  const [sourceCandidates, setSourceCandidates] = useState<SourceCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agentForm, setAgentForm] = useState(emptyAgentForm);
  const [automationForm, setAutomationForm] = useState(emptyAutomationForm);
  const [teamForm, setTeamForm] = useState(emptyTeamForm);
  const [channelForm, setChannelForm] = useState(emptyChannelForm);
  const [sourceForm, setSourceForm] = useState(emptySourceForm);
  const [pairingCode, setPairingCode] = useState("");
  const [lastPairingCode, setLastPairingCode] = useState("");
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([]);
  const [skillAgentId, setSkillAgentId] = useState("");
  const [browserTask, setBrowserTask] = useState("");
  const [browserCommand, setBrowserCommand] = useState("");
  const [selectedBrowserSessionId, setSelectedBrowserSessionId] = useState("");

  const agentNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const agent of agents) map.set(agent.id, agent.name);
    return map;
  }, [agents]);

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
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error || payload.message || `Request failed (${response.status})`);
    }

    return payload;
  }, []);

  const loadData = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      const [
        summaryPayload,
        agentsPayload,
        automationsPayload,
        browserPayload,
        skillsPayload,
        teamsPayload,
        runsPayload,
        channelsPayload,
        pairingPayload,
        sourcesPayload,
      ] = await Promise.all([
        authFetch("/api/work/summary"),
        authFetch("/api/work/agents"),
        authFetch("/api/work/automations"),
        authFetch("/api/work/browser"),
        authFetch("/api/work/skills"),
        authFetch("/api/work/teams"),
        authFetch("/api/work/runs?limit=30"),
        authFetch("/api/work/channels"),
        authFetch("/api/work/pairing"),
        authFetch("/api/work/sources?limit=30"),
      ]);

      setSummary(summaryPayload);
      setAgents(agentsPayload.agents || []);
      setAutomations(automationsPayload.automations || []);
      setBrowserSessions(browserPayload.sessions || []);
      setSkillCatalog(skillsPayload.catalog || []);
      setInstalledSkills(skillsPayload.installed || []);
      setMcpServers(skillsPayload.mcpServers || []);
      setTeams(teamsPayload.teams || []);
      setRuns(runsPayload.runs || []);
      setChannels(channelsPayload.catalog || []);
      setChannelConnections(channelsPayload.connections || []);
      setPairing(pairingPayload);
      setSourceCatalog(sourcesPayload.catalog || []);
      setSourceTasks(sourcesPayload.tasks || []);
      setSourceCandidates(sourcesPayload.candidates || []);
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

  async function saveAgent() {
    setSaving("agent");
    try {
      const body = JSON.stringify(agentForm);
      if (agentForm.id) {
        await authFetch(`/api/work/agents/${agentForm.id}`, { method: "PATCH", body });
        toast.success("Agent updated.");
      } else {
        await authFetch("/api/work/agents", { method: "POST", body });
        toast.success("Agent created.");
      }
      setAgentForm(emptyAgentForm);
      await loadData();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Agent save failed.");
    } finally {
      setSaving(null);
    }
  }

  async function deleteAgent(agentId: string) {
    setSaving(`delete-agent:${agentId}`);
    try {
      await authFetch(`/api/work/agents/${agentId}`, { method: "DELETE" });
      toast.success("Agent archived.");
      await loadData();
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Agent archive failed.");
    } finally {
      setSaving(null);
    }
  }

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
      setSelectedBrowserSessionId(payload.id || "");
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

  async function installSkill(skill: SkillTemplate) {
    setSaving(`skill:${skill.id}`);
    try {
      await authFetch("/api/work/skills", {
        method: "POST",
        body: JSON.stringify({
          skillId: skill.id,
          scope: skillAgentId ? "agent" : skill.defaultScope,
          agentId: skillAgentId || null,
        }),
      });
      toast.success("Skill installed.");
      await loadData();
    } catch (skillError) {
      toast.error(skillError instanceof Error ? skillError.message : "Skill install failed.");
    } finally {
      setSaving(null);
    }
  }

  async function installMcpSkill(server: McpServer) {
    setSaving(`mcp-skill:${server.id}`);
    try {
      await authFetch("/api/work/skills", {
        method: "POST",
        body: JSON.stringify({
          mcpServerId: server.id,
          scope: skillAgentId ? "agent" : "account",
          agentId: skillAgentId || null,
        }),
      });
      toast.success("MCP skill installed.");
      await loadData();
    } catch (skillError) {
      toast.error(skillError instanceof Error ? skillError.message : "MCP skill install failed.");
    } finally {
      setSaving(null);
    }
  }

  async function removeSkill(skillId: string) {
    setSaving(`remove-skill:${skillId}`);
    try {
      await authFetch(`/api/work/skills/${skillId}`, { method: "DELETE" });
      toast.success("Skill removed.");
      await loadData();
    } catch (skillError) {
      toast.error(skillError instanceof Error ? skillError.message : "Skill removal failed.");
    } finally {
      setSaving(null);
    }
  }

  async function createTeam() {
    if (!teamForm.leadAgentId) return;
    setSaving("team");
    try {
      await authFetch("/api/work/teams", {
        method: "POST",
        body: JSON.stringify({
          ...teamForm,
          memberAgentIds: teamMemberIds,
        }),
      });
      toast.success("Team created.");
      setTeamForm(emptyTeamForm);
      setTeamMemberIds([]);
      await loadData();
    } catch (teamError) {
      toast.error(teamError instanceof Error ? teamError.message : "Team save failed.");
    } finally {
      setSaving(null);
    }
  }

  async function deleteTeam(teamId: string) {
    setSaving(`delete-team:${teamId}`);
    try {
      await authFetch(`/api/work/teams/${teamId}`, { method: "DELETE" });
      toast.success("Team archived.");
      await loadData();
    } catch (teamError) {
      toast.error(teamError instanceof Error ? teamError.message : "Team archive failed.");
    } finally {
      setSaving(null);
    }
  }

  async function runTeam(teamId: string) {
    setSaving(`team-run:${teamId}`);
    try {
      await authFetch(`/api/work/teams/${teamId}/run`, {
        method: "POST",
        body: JSON.stringify({ task: "Create a team progress update and next-step summary." }),
      });
      toast.success("Team run started.");
      await loadData();
    } catch (teamError) {
      toast.error(teamError instanceof Error ? teamError.message : "Team run failed.");
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
      setLastPairingCode(String(payload.code || ""));
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

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Work Platform</h1>
          <p className="text-sm text-muted-foreground">Agents, automations, integrations, local tools, skills, and team runs.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => void loadData()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-lg border bg-background p-1">
        {WORK_VIEWS.map((view) => {
          const Icon = view.icon;
          return (
            <button
              key={view.id}
              type="button"
              onClick={() => setActiveView(view.id)}
              className={cn(
                "flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
                activeView === view.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {view.label}
            </button>
          );
        })}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {activeView === "overview" ? (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Agents" value={summary?.counts?.agents ?? agents.length} icon={Bot} />
            <MetricCard label="Automations" value={summary?.counts?.automations ?? automations.length} icon={Workflow} />
            <MetricCard label="Skills and MCP" value={(summary?.counts?.mcpServers ?? mcpServers.length) + installedSkills.length} icon={Puzzle} />
            <MetricCard label="Runs" value={summary?.counts?.runs ?? runs.length} icon={Activity} />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            {[
              ["Desktop Runtime", summary?.readiness?.desktopRuntime ? "local" : "web", Laptop],
              ["Browser Automation", summary?.readiness?.browserAutomation ? "ready" : "local only", Globe2],
              ["Integrations", summary?.readiness?.connectors ? "connected" : "setup", Plug],
              ["Skills", "ready", Puzzle],
              ["Channels", channelConnections.length > 0 ? "active" : "live shells", Radio],
              ["Sources", sourceTasks.length > 0 ? "running" : "ready", Globe2],
              ["Pairing", String(summary?.readiness?.pairing || "web"), ShieldCheck],
            ].map(([label, status, Icon]) => (
              <Card key={String(label)} className="rounded-lg">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{String(label)}</span>
                  </div>
                  <Badge variant={statusVariant(String(status))}>{String(status)}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {activeView === "agents" ? (
        <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="h-4 w-4" />
                {agentForm.id ? "Edit Agent" : "Create Agent"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Agent name"
                value={agentForm.name}
                onChange={(event) => setAgentForm({ ...agentForm, name: event.target.value })}
              />
              <Input
                placeholder="Short summary"
                value={agentForm.summary}
                onChange={(event) => setAgentForm({ ...agentForm, summary: event.target.value })}
              />
              <Input
                placeholder="Role"
                value={agentForm.role}
                onChange={(event) => setAgentForm({ ...agentForm, role: event.target.value })}
              />
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={agentForm.capabilityPreset}
                onChange={(event) => setAgentForm({ ...agentForm, capabilityPreset: event.target.value })}
              >
                <option value="standard">Standard</option>
                <option value="full">Full</option>
                <option value="minimal">Minimal</option>
                <option value="team_lead">Team lead</option>
              </select>
              <Textarea
                className="min-h-32"
                placeholder="Agent instructions"
                value={agentForm.instructions}
                onChange={(event) => setAgentForm({ ...agentForm, instructions: event.target.value })}
              />
              <div className="flex gap-2">
                <Button type="button" onClick={() => void saveAgent()} disabled={saving === "agent"}>
                  {saving === "agent" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save
                </Button>
                {agentForm.id ? (
                  <Button type="button" variant="outline" onClick={() => setAgentForm(emptyAgentForm)}>
                    Cancel
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <SectionTitle icon={Bot} title="Agent Hub" />
            <div className="grid gap-3 lg:grid-cols-2">
              {agents.map((agent) => (
                <Card key={agent.id} className="rounded-lg">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{agent.name}</div>
                        <div className="text-sm text-muted-foreground">{agent.summary}</div>
                      </div>
                      <Badge variant={agent.source === "built_in" ? "secondary" : "default"}>
                        {agent.source === "built_in" ? "Built-in" : "Custom"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>{agent.capability_preset}</span>
                      <span>{agent.model_id || "auto"}</span>
                      <span>{agent.installed_skill_ids.length} skills</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm">
                        <Link href={`/chat/new?agentId=${encodeURIComponent(agent.id)}`}>
                          <MessageSquare className="h-4 w-4" />
                          Chat
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setAgentForm({
                            id: agent.id,
                            name: agent.name,
                            summary: agent.summary,
                            role: agent.role,
                            instructions: agent.instructions,
                            capabilityPreset: agent.capability_preset,
                          })
                        }
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void deleteAgent(agent.id)}
                        disabled={saving === `delete-agent:${agent.id}`}
                      >
                        {saving === `delete-agent:${agent.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Archive
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {activeView === "automations" ? (
        <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Workflow className="h-4 w-4" />
                New Automation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Name" value={automationForm.name} onChange={(event) => setAutomationForm({ ...automationForm, name: event.target.value })} />
              <Textarea className="min-h-28" placeholder="Task" value={automationForm.task} onChange={(event) => setAutomationForm({ ...automationForm, task: event.target.value })} />
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={automationForm.schedule} onChange={(event) => setAutomationForm({ ...automationForm, schedule: event.target.value })}>
                <option value="weekdays">Weekdays</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="hourly">Hourly</option>
              </select>
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={automationForm.runTarget} onChange={(event) => setAutomationForm({ ...automationForm, runTarget: event.target.value })}>
                <option value="agent">Agent</option>
                <option value="team">Team</option>
                <option value="browser">Browser</option>
                <option value="python">Python</option>
                <option value="sync">Sync</option>
              </select>
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={automationForm.agentId} onChange={(event) => setAutomationForm({ ...automationForm, agentId: event.target.value })}>
                <option value="">No agent</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>{agent.name}</option>
                ))}
              </select>
              <Button type="button" onClick={() => void createAutomation()} disabled={saving === "automation"}>
                {saving === "automation" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Save Automation
              </Button>
            </CardContent>
          </Card>
          <div className="space-y-3">
            <SectionTitle icon={Workflow} title="Scheduled Automations" />
            {automations.map((automation) => (
              <Card key={automation.id} className="rounded-lg">
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
                    <span>{automation.agent_id ? agentNameById.get(automation.agent_id) || "Agent" : "No agent"}</span>
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

      {activeView === "browser" ? (
        <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
          <Card className="rounded-lg">
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
              <div className="rounded-lg border px-3 py-2 text-xs text-muted-foreground">
                Local browser sessions use the repo browser-use runner and keep risky actions approval-gated.
              </div>
            </CardContent>
          </Card>
          <div className="space-y-3">
            <SectionTitle icon={Globe2} title="Browser Sessions" />
            {browserSessions.length === 0 ? (
              <Card className="rounded-lg"><CardContent className="p-4 text-sm text-muted-foreground">No active browser sessions.</CardContent></Card>
            ) : null}
            {browserSessions.map((session) => (
              <Card key={session.id} className="rounded-lg">
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{session.title || session.task}</div>
                      <div className="truncate text-sm text-muted-foreground">{session.currentUrl || session.summary || session.task}</div>
                    </div>
                    <Badge variant={statusVariant(session.status)}>{session.status || (session.isRunning ? "running" : "closed")}</Badge>
                  </div>
                  {session.setupError ? <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">{session.setupError}</div> : null}
                  {session.awaitingApproval ? (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">
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
            <Card className="rounded-lg">
              <CardContent className="space-y-3 p-4">
                <div className="text-sm font-medium">Follow-up Command</div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select className="h-10 rounded-md border bg-background px-3 text-sm sm:w-64" value={selectedBrowserSessionId} onChange={(event) => setSelectedBrowserSessionId(event.target.value)}>
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

      {activeView === "skills" ? (
        <div className="space-y-5">
          <SectionTitle icon={Puzzle} title="Skills" />
          <Card className="rounded-lg">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="text-sm font-medium">Install scope</div>
              <select className="h-10 rounded-md border bg-background px-3 text-sm sm:w-80" value={skillAgentId} onChange={(event) => setSkillAgentId(event.target.value)}>
                <option value="">Account-level</option>
                {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
              </select>
            </CardContent>
          </Card>
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {skillCatalog.map((skill) => (
              <Card key={skill.id} className="rounded-lg">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{skill.name}</div>
                      <div className="text-sm text-muted-foreground">{skill.description}</div>
                    </div>
                    <Badge variant="secondary">{skill.category}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">{skill.capabilities.join(", ")}</div>
                  <Button size="sm" onClick={() => void installSkill(skill)} disabled={saving === `skill:${skill.id}`}>
                    {saving === `skill:${skill.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Install
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <Card className="rounded-lg">
              <CardHeader><CardTitle className="text-base">Installed Skills</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {installedSkills.length === 0 ? <div className="text-sm text-muted-foreground">No installed skills yet.</div> : null}
                {installedSkills.map((skill) => (
                  <div key={skill.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{skill.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{skill.scope} / {skill.source}</div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => void removeSkill(skill.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="rounded-lg">
              <CardHeader><CardTitle className="text-base">MCP Skill Sources</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {mcpServers.length === 0 ? <div className="text-sm text-muted-foreground">No MCP servers configured.</div> : null}
                {mcpServers.map((server) => (
                  <div key={server.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <span className="text-sm font-medium">{server.name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={server.is_active ? "default" : "secondary"}>{server.type}</Badge>
                      <Button size="sm" variant="outline" onClick={() => void installMcpSkill(server)} disabled={saving === `mcp-skill:${server.id}`}>
                        {saving === `mcp-skill:${server.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
          <McpServersSection onServersChange={loadData} />
        </div>
      ) : null}

      {activeView === "teams" ? (
        <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
          <Card className="rounded-lg">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />Create Team</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Team name" value={teamForm.name} onChange={(event) => setTeamForm({ ...teamForm, name: event.target.value })} />
              <Input placeholder="Description" value={teamForm.description} onChange={(event) => setTeamForm({ ...teamForm, description: event.target.value })} />
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={teamForm.leadAgentId} onChange={(event) => setTeamForm({ ...teamForm, leadAgentId: event.target.value })}>
                <option value="">Lead agent</option>
                {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
              </select>
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border p-2">
                {agents.map((agent) => (
                  <label key={agent.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm">
                    <input
                      type="checkbox"
                      checked={teamMemberIds.includes(agent.id)}
                      onChange={(event) => {
                        setTeamMemberIds((current) =>
                          event.target.checked
                            ? Array.from(new Set([...current, agent.id]))
                            : current.filter((id) => id !== agent.id)
                        );
                      }}
                    />
                    {agent.name}
                  </label>
                ))}
              </div>
              <Button type="button" onClick={() => void createTeam()} disabled={saving === "team" || !teamForm.leadAgentId}>
                {saving === "team" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create Team
              </Button>
            </CardContent>
          </Card>
          <div className="space-y-3">
            <SectionTitle icon={Users} title="Teams" />
            {teams.map((team) => (
              <Card key={team.id} className="rounded-lg">
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{team.name}</div>
                      <div className="text-sm text-muted-foreground">{team.description || "No description"}</div>
                    </div>
                    <Badge variant="secondary">{team.mode}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Lead: {agentNameById.get(team.lead_agent_id) || "Unknown"} / Members: {team.members?.length ?? 0}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => void runTeam(team.id)} disabled={saving === `team-run:${team.id}`}>
                      {saving === `team-run:${team.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      Run
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void deleteTeam(team.id)} disabled={saving === `delete-team:${team.id}`}>
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

      {activeView === "channels" ? (
        <div className="space-y-5">
          <SectionTitle icon={Radio} title="Channels And Pairing" />
          <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
            <div className="space-y-3">
              <Card className="rounded-lg">
                <CardHeader><CardTitle className="text-base">Connect Channel</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={channelForm.provider} onChange={(event) => setChannelForm({ ...channelForm, provider: event.target.value })}>
                    {channels.map((channel) => (
                      <option key={channel.provider} value={channel.provider}>{channel.label}</option>
                    ))}
                  </select>
                  <Input placeholder="Label" value={channelForm.label} onChange={(event) => setChannelForm({ ...channelForm, label: event.target.value })} />
                  <Input placeholder="Channel, chat, or recipient ID" value={channelForm.externalChannelId} onChange={(event) => setChannelForm({ ...channelForm, externalChannelId: event.target.value })} />
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={channelForm.autoReplyEnabled} onChange={(event) => setChannelForm({ ...channelForm, autoReplyEnabled: event.target.checked })} />
                    Auto-reply without manual approval
                  </label>
                  <Button type="button" onClick={() => void createChannelConnection()} disabled={saving === "channel"}>
                    {saving === "channel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Save Connection
                  </Button>
                </CardContent>
              </Card>
              <Card className="rounded-lg">
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
                  <Card key={channel.provider} className="rounded-lg">
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
              <Card className="rounded-lg">
                <CardHeader><CardTitle className="text-base">Connections</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {channelConnections.length === 0 ? <div className="text-sm text-muted-foreground">No channel connections saved.</div> : null}
                  {channelConnections.map((connection) => (
                    <div key={connection.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2">
                      <div>
                        <div className="text-sm font-medium">{connection.label}</div>
                        <div className="text-xs text-muted-foreground">{connection.provider} / {connection.external_channel_id || "no external id"}</div>
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
              <Card className="rounded-lg">
                <CardHeader><CardTitle className="text-base">Paired Devices</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {(pairing?.devices || []).length === 0 ? <div className="text-sm text-muted-foreground">No paired desktop devices.</div> : null}
                  {(pairing?.devices || []).map((device) => (
                    <div key={device.id} className="flex items-center justify-between rounded-md border px-3 py-2">
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
          <Card className="rounded-lg">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Globe2 className="h-4 w-4" />Source Research</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={sourceForm.provider} onChange={(event) => setSourceForm({ ...sourceForm, provider: event.target.value })}>
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
                <Card key={source.provider} className="rounded-lg">
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
            {sourceTasks.length === 0 ? <Card className="rounded-lg"><CardContent className="p-4 text-sm text-muted-foreground">No source research tasks yet.</CardContent></Card> : null}
            {sourceTasks.map((task) => (
              <Card key={task.id} className="rounded-lg">
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
              <Card className="rounded-lg">
                <CardHeader><CardTitle className="text-base">Recent Candidates</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {sourceCandidates.slice(0, 8).map((candidate) => (
                    <div key={candidate.id} className="rounded-md border px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="truncate text-sm font-medium">{candidate.title}</div>
                        <Badge variant="secondary">{candidate.provider}</Badge>
                      </div>
                      <div className="line-clamp-2 text-xs text-muted-foreground">{candidate.summary || candidate.url || "No summary"}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      ) : null}

      {activeView === "runs" ? (
        <div className="space-y-3">
          <SectionTitle icon={ShieldCheck} title="Runs And Approvals" action={<Button asChild variant="outline"><Link href="/terminal">Operations</Link></Button>} />
          {runs.length === 0 ? <Card className="rounded-lg"><CardContent className="p-4 text-sm text-muted-foreground">No runs recorded yet.</CardContent></Card> : null}
          {runs.map((run) => (
            <Card key={`${run.source}:${run.id}`} className="rounded-lg">
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
