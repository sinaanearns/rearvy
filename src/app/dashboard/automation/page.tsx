"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, RefreshCw } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { getIdToken } from "@/lib/firebase/auth";
import {
  ApprovalPanel,
  AutomationRunTimeline,
  ExecutiveModulePage,
  getExecutiveOsModule,
  type AutomationStatus,
  type TimelineItem,
} from "@/components/executive-os/executive-os";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SandboxRun = {
  id: string;
  script_id: string | null;
  script_name: string | null;
  source: "script" | "adhoc";
  status: AutomationStatus;
  approval_required: boolean;
  risk_level: "low" | "medium" | "high";
  requested_by: string | null;
  created_at: string;
  updated_at: string;
  stdout: string[];
  stderr: string[];
  artifacts: Array<{ name: string; path: string }>;
};

type SandboxScript = {
  id: string;
  name: string;
  approval_state: "draft" | "approved" | "archived";
  last_run_status: AutomationStatus | null;
  version: number;
  updated_at: string;
  tags: string[];
};

const RUN_STATUS_STYLES: Record<AutomationStatus, string> = {
  queued: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  running: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  awaiting_approval:
    "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  completed:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  failed: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  canceled:
    "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
};

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="border-border/70 bg-card/80 shadow-sm">
      <CardContent className="space-y-2 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

export default function AutomationPage() {
  const pageModule = getExecutiveOsModule("automation");
  const { user, loading: authLoading } = useAuth();
  const [runs, setRuns] = useState<SandboxRun[]>([]);
  const [scripts, setScripts] = useState<SandboxScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    async function loadAutomationData() {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const token = await getIdToken();
        if (!token) {
          throw new Error("Missing auth token");
        }

        const [runsResponse, scriptsResponse] = await Promise.all([
          fetch("/api/automation/python/runs?limit=8", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/automation/python/scripts?limit=8", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!runsResponse.ok) {
          throw new Error(`Failed to load automation runs (${runsResponse.status})`);
        }

        if (!scriptsResponse.ok) {
          throw new Error(`Failed to load automation scripts (${scriptsResponse.status})`);
        }

        const runsPayload = (await runsResponse.json()) as { runs?: SandboxRun[] };
        const scriptsPayload = (await scriptsResponse.json()) as { scripts?: SandboxScript[] };

        setRuns(runsPayload.runs || []);
        setScripts(scriptsPayload.scripts || []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load automation data.");
      } finally {
        setLoading(false);
      }
    }

    void loadAutomationData();
  }, [user, refreshIndex]);

  const summaryCards = [
    {
      label: "Recent runs",
      value: String(runs.length),
      detail: "Queued, running, and completed sandbox executions.",
    },
    {
      label: "Approval gates",
      value: String(runs.filter((run) => run.approval_required).length),
      detail: "Runs waiting for a human to approve before execution.",
    },
    {
      label: "Approved scripts",
      value: String(scripts.filter((script) => script.approval_state === "approved").length),
      detail: "Ready-to-run scripts with an approved policy state.",
    },
    {
      label: "Draft scripts",
      value: String(scripts.filter((script) => script.approval_state === "draft").length),
      detail: "Work in progress scripts still being shaped by the team.",
    },
  ];

  const timelineItems: TimelineItem[] =
    runs.slice(0, 3).map((run) => ({
      title: run.script_name || `Run ${run.id.slice(0, 8)}`,
      description:
        run.status === "awaiting_approval"
          ? "Execution is blocked until the approval policy is satisfied."
          : run.status === "running"
            ? "Sandbox execution is in progress and writing logs."
            : run.status === "completed"
              ? "Execution finished and artifacts were persisted."
              : run.status === "failed"
                ? "Execution stopped with an error and needs review."
                : "The run is waiting in the queue.",
      status: run.status,
      detail: `Updated ${formatDate(run.updated_at)}`,
    })) || [];

  if (timelineItems.length === 0) {
    timelineItems.push(
      {
        title: "Queue run",
        description: "No live runs yet. Start a script to populate the execution timeline.",
        status: "queued",
      },
      {
        title: "Policy review",
        description: "Approval-sensitive runs will pause here until a reviewer signs off.",
        status: "awaiting_approval",
      },
      {
        title: "Artifact capture",
        description: "Outputs, logs, and evidence will be attached to the run record.",
        status: "completed",
      }
    );
  }

  const recentRuns = runs.slice(0, 5);
  const recentScripts = scripts.slice(0, 5);

  return (
    <ExecutiveModulePage pageModule={pageModule}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <SummaryCard key={card.label} {...card} />
        ))}
      </div>

      {error && (
        <Card className="border-rose-500/30 bg-rose-500/5 shadow-sm">
          <CardHeader className="space-y-2 border-b border-rose-500/20 pb-4">
            <CardTitle className="text-base text-rose-700 dark:text-rose-300">Automation data unavailable</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Button variant="outline" onClick={() => setRefreshIndex((value) => value + 1)}>
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        {loading ? (
          <Card className="border-border/70 bg-card/80 shadow-sm">
            <CardContent className="flex min-h-[320px] items-center justify-center p-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : (
          <AutomationRunTimeline items={timelineItems} />
        )}

        <ApprovalPanel
          title="Approval policy"
          riskLevel="medium"
          state="Low-risk runs queue automatically, medium-risk runs await approval, and high-risk runs require a named approver."
          policy="This module follows the approval matrix from the Executive OS spec so mutating or externally visible actions do not run without human oversight."
          bullets={[
            "Browser and Python tasks share an audit-friendly run record.",
            "Mutating actions capture evidence before and after execution.",
            "Each run can be traced from task request to artifact generation.",
          ]}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/70 pb-4">
            <div>
              <CardTitle className="text-base">Recent runs</CardTitle>
              <CardDescription>Open a run to inspect logs, artifacts, and the approval state.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setRefreshIndex((value) => value + 1)}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 pt-6">
            {recentRuns.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
                No runs yet. Execute a Python sandbox script to populate this queue.
              </div>
            ) : (
              recentRuns.map((run) => (
                <Link key={run.id} href={`/dashboard/automation/runs/${run.id}`} className="block">
                  <div className="group rounded-2xl border border-border/70 bg-background/70 p-4 transition-colors hover:bg-muted/30">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{run.script_name || `Run ${run.id.slice(0, 8)}`}</p>
                          <Badge variant="outline" className={cn("capitalize", RUN_STATUS_STYLES[run.status])}>
                            {formatStatus(run.status)}
                          </Badge>
                          <Badge variant="outline" className={cn(
                            run.approval_required
                              ? "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          )}>
                            {run.approval_required ? "approval required" : "auto-approved"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {run.source === "script" ? "Saved script" : "Ad hoc code"} - {formatDate(run.created_at)}
                        </p>
                      </div>
                      <ArrowRight className="mt-1 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full border border-border/70 px-2 py-1">Risk: {run.risk_level}</span>
                      <span className="rounded-full border border-border/70 px-2 py-1">Artifacts: {run.artifacts.length}</span>
                      <span className="rounded-full border border-border/70 px-2 py-1">Logs: {run.stdout.length + run.stderr.length}</span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/70 pb-4">
            <div>
              <CardTitle className="text-base">Scripts registry</CardTitle>
              <CardDescription>Approval state and revision history for saved sandbox scripts.</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/automation/recipes">Open recipes</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 pt-6">
            {loading ? (
              <div className="flex items-center justify-center rounded-2xl border border-dashed border-border/70 py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : recentScripts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
                No scripts yet. Save a sandbox script to turn a prompt into a reusable recipe.
              </div>
            ) : (
              recentScripts.map((script) => (
                <div key={script.id} className="rounded-2xl border border-border/70 bg-background/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{script.name}</p>
                      <p className="text-sm text-muted-foreground">Version {script.version} - {formatDate(script.updated_at)}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        script.approval_state === "approved"
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : script.approval_state === "draft"
                            ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                            : "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300"
                      )}
                    >
                      {script.approval_state}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {script.tags.length > 0 ? (
                      script.tags.map((tag) => (
                        <span key={tag} className="rounded-full border border-border/70 px-2 py-1">
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full border border-border/70 px-2 py-1">No tags</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm">
        <div>
          <p className="text-sm font-medium">Recipe recorder beta</p>
          <p className="text-sm text-muted-foreground">
            Turn repeated sandbox flows into reusable browser or Python recipes once the workflow is stable.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard/automation/recipes">
            Open the recipe catalog
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </ExecutiveModulePage>
  );
}
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Rocket, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { getIdToken } from "@/lib/firebase/auth";
import {
  ApprovalPanel,
  AutomationRunTimeline,
  ExecutiveModulePage,
  getExecutiveOsModule,
  RiskBadge,
  type AutomationStatus,
} from "@/components/executive-os/executive-os";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type PythonSandboxRun = {
  id: string;
  script_name: string | null;
  source: "script" | "adhoc";
  status: AutomationStatus;
  approval_required: boolean;
  risk_level: "low" | "medium" | "high";
  created_at: string;
  updated_at: string;
  stdout: string[];
  stderr: string[];
  artifacts: Array<{ name: string; path: string }>;
  error: string | null;
};

type PythonSandboxScript = {
  id: string;
  name: string;
  approval_state: "draft" | "approved" | "archived";
  version: number;
  last_run_status: AutomationStatus | null;
  updated_at: string;
};

const RUN_STATUS_CLASSES: Record<AutomationStatus, string> = {
  queued:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  running:
    "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  awaiting_approval:
    "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  completed:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  failed: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  canceled:
    "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
};

function formatStatusLabel(value: string) {
  return value.replaceAll("_", " ");
}

function countRuns(runs: PythonSandboxRun[]) {
  return runs.reduce(
    (accumulator, run) => {
      accumulator[run.status] += 1;
      return accumulator;
    },
    {
      queued: 0,
      running: 0,
      awaiting_approval: 0,
      completed: 0,
      failed: 0,
      canceled: 0,
    } satisfies Record<AutomationStatus, number>
  );
}

function countScripts(scripts: PythonSandboxScript[]) {
  return scripts.reduce(
    (accumulator, script) => {
      accumulator[script.approval_state] += 1;
      return accumulator;
    },
    {
      draft: 0,
      approved: 0,
      archived: 0,
    } satisfies Record<PythonSandboxScript["approval_state"], number>
  );
}

function relativeTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function RunRow({ run }: { run: PythonSandboxRun }) {
  return (
    <Link href={`/dashboard/automation/runs/${run.id}`} className="block">
      <div className="rounded-2xl border border-border/70 bg-background/70 p-4 transition-colors hover:bg-muted/40">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium text-foreground">
              {run.script_name || "Ad hoc run"}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatStatusLabel(run.source)} - {relativeTimestamp(run.created_at)}
            </p>
          </div>
          <Badge variant="outline" className={RUN_STATUS_CLASSES[run.status]}>
            {formatStatusLabel(run.status)}
          </Badge>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <RiskBadge level={run.risk_level} />
          {run.approval_required && (
            <Badge variant="outline" className="border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300">
              Approval required
            </Badge>
          )}
          <span>{run.artifacts.length} artifacts</span>
          <span>{run.stderr.length} stderr lines</span>
        </div>
        {run.error && (
          <p className="mt-3 text-sm text-rose-600 dark:text-rose-300">{run.error}</p>
        )}
      </div>
    </Link>
  );
}

function ScriptRow({ script }: { script: PythonSandboxScript }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium text-foreground">{script.name}</p>
          <p className="text-xs text-muted-foreground">
            Version {script.version} - {relativeTimestamp(script.updated_at)}
          </p>
        </div>
        <Badge variant="outline" className="border-border/70 bg-background/80">
          {script.approval_state}
        </Badge>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {script.last_run_status ? (
          <Badge variant="outline" className={RUN_STATUS_CLASSES[script.last_run_status]}>
            Last run {formatStatusLabel(script.last_run_status)}
          </Badge>
        ) : (
          <span>No prior run yet</span>
        )}
      </div>
    </div>
  );
}

export default function AutomationPage() {
  const pageModule = getExecutiveOsModule("automation");
  const { user, loading: authLoading } = useAuth();
  const [runs, setRuns] = useState<PythonSandboxRun[]>([]);
  const [scripts, setScripts] = useState<PythonSandboxScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAutomationData() {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const token = await getIdToken();
        if (!token) {
          throw new Error("Missing auth token");
        }

        const [runsResponse, scriptsResponse] = await Promise.all([
          fetch("/api/automation/python/runs?limit=12", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/automation/python/scripts?limit=12", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!runsResponse.ok) {
          throw new Error(`Failed to load automation runs (${runsResponse.status})`);
        }

        if (!scriptsResponse.ok) {
          throw new Error(`Failed to load automation scripts (${scriptsResponse.status})`);
        }

        const runsPayload = (await runsResponse.json()) as { runs?: PythonSandboxRun[] };
        const scriptsPayload = (await scriptsResponse.json()) as {
          scripts?: PythonSandboxScript[];
        };

        setRuns(runsPayload.runs ?? []);
        setScripts(scriptsPayload.scripts ?? []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load automation data");
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      void loadAutomationData();
    }
  }, [authLoading, user, refreshIndex]);

  const runCounts = countRuns(runs);
  const scriptCounts = countScripts(scripts);

  const timelineItems = runs.slice(0, 4).map((run) => ({
    title: run.script_name || `Run ${run.id.slice(0, 8)}`,
    description:
      run.source === "script"
        ? "Script-backed execution queued through the sandbox registry."
        : "Ad hoc execution staged for review and completion.",
    status: run.status,
    detail: `${run.artifacts.length} artifacts - ${relativeTimestamp(run.created_at)}`,
  }));

  return (
    <ExecutiveModulePage pageModule={pageModule}>
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Python sandbox
            </p>
            <h2 className="text-2xl font-semibold tracking-tight">Live automation queue</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Review recent runs, approval state, and the script registry that powers recurring execution.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setRefreshIndex((current) => current + 1)}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-border/70 bg-card/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardDescription>Total runs</CardDescription>
              <CardTitle className="text-3xl">{runs.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-border/70 bg-card/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardDescription>Queued or running</CardDescription>
              <CardTitle className="text-3xl">
                {runCounts.queued + runCounts.running + runCounts.awaiting_approval}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-border/70 bg-card/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardDescription>Approved scripts</CardDescription>
              <CardTitle className="text-3xl">{scriptCounts.approved}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-border/70 bg-card/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardDescription>Awaiting approval</CardDescription>
              <CardTitle className="text-3xl">{runCounts.awaiting_approval}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </section>

      {error && (
        <Card className="border-rose-500/20 bg-rose-500/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-rose-600" />
              <CardTitle className="text-base">Automation data unavailable</CardTitle>
            </div>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/dashboard/automation/recipes">Open recipe catalog</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader className="border-b border-border/70">
            <CardTitle className="text-base">Recent runs</CardTitle>
            <CardDescription>
              The latest Python sandbox executions and their risk posture.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-6">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : runs.length > 0 ? (
              runs.slice(0, 6).map((run) => <RunRow key={run.id} run={run} />)
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
                No runs yet. Launch a script from the sandbox registry to populate the queue.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <ApprovalPanel
            title="Approval policy"
            riskLevel="medium"
            state="Default policy for automation runs"
            policy="Low-risk extraction and draft generation can queue automatically. Medium-risk runs default to awaiting approval, and high-risk tasks require a named approver before execution."
            bullets={[
              "Capture before and after evidence for mutating steps.",
              "Keep customer-scoped data inside the tenant boundary.",
              "Promote repeated flows into recipes once they are validated.",
            ]}
          />

          <Card className="border-border/70 bg-card/80 shadow-sm">
            <CardHeader className="border-b border-border/70">
              <CardTitle className="text-base">Scripts</CardTitle>
              <CardDescription>
                Reusable Python workflows with approval state and version history.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-6">
              {loading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : scripts.length > 0 ? (
                scripts.slice(0, 5).map((script) => <ScriptRow key={script.id} script={script} />)
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 px-4 py-8 text-sm text-muted-foreground">
                  No saved scripts yet. Start from a recipe and promote it here once it is approved.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/80 shadow-sm">
            <CardHeader className="border-b border-border/70">
              <CardTitle className="text-base">Recipe recorder</CardTitle>
              <CardDescription>
                Convert repeated browser or sandbox flows into reusable instructions.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href="/dashboard/automation/recipes">
                    <Sparkles className="h-4 w-4" />
                    Open recipes
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/dashboard/briefing">
                    <Rocket className="h-4 w-4" />
                    Review morning brief
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <AutomationRunTimeline items={timelineItems} />
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader className="border-b border-border/70">
            <CardTitle className="text-base">Execution guardrails</CardTitle>
            <CardDescription>
              The defaults that keep automation safe while the surface expands.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6 text-sm text-muted-foreground">
            <div className="rounded-2xl border border-border/70 p-4">
              <p className="font-medium text-foreground">Approval gates</p>
              <p className="mt-2">Medium and high risk runs default to awaiting approval.</p>
            </div>
            <div className="rounded-2xl border border-border/70 p-4">
              <p className="font-medium text-foreground">Execution limits</p>
              <p className="mt-2">Python sandbox runs terminate within 120 seconds and 512 MB by default.</p>
            </div>
            <div className="rounded-2xl border border-border/70 p-4">
              <p className="font-medium text-foreground">Evidence trail</p>
              <p className="mt-2">Stored runs keep output, artifacts, and errors available for later review.</p>
            </div>
          </CardContent>
        </Card>
      </section>
    </ExecutiveModulePage>
  );
}
