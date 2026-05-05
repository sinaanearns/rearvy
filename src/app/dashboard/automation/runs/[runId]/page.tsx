"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, RefreshCw, FileText, PackageOpen } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { getIdToken } from "@/lib/firebase/auth";
import {
  ApprovalPanel,
  ArtifactPreviewCard,
  AutomationRunTimeline,
  ExecutiveModulePage,
  getExecutiveOsModule,
  RiskBadge,
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

type PythonSandboxRun = {
  id: string;
  script_id: string | null;
  script_name: string | null;
  source: "script" | "adhoc";
  code: string;
  input: Record<string, unknown>;
  status: AutomationStatus;
  approval_required: boolean;
  risk_level: "low" | "medium" | "high";
  allow_network: boolean;
  max_runtime_seconds: number;
  max_memory_mb: number;
  allowed_data_scopes: string[];
  requested_by: string | null;
  result: unknown | null;
  error: string | null;
  stdout: string[];
  stderr: string[];
  artifacts: Array<{
    name: string;
    path: string;
    content_type: string | null;
    size_bytes: number | null;
  }>;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
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

function formatTimestamp(value: string | null) {
  if (!value) return "Not started";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

interface RunPageProps {
  params: Promise<{ runId: string }>;
}

export default function AutomationRunPage({ params }: RunPageProps) {
  const pageModule = getExecutiveOsModule("automation");
  const { user, loading: authLoading } = useAuth();
  const [runId, setRunId] = useState<string>("");
  const [run, setRun] = useState<PythonSandboxRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then(({ runId: nextRunId }) => setRunId(nextRunId));
  }, [params]);

  useEffect(() => {
    async function loadRun() {
      if (!user || !runId) {
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

        const response = await fetch(`/api/automation/python/runs/${runId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          throw new Error(`Failed to load automation run (${response.status})`);
        }

        const payload = (await response.json()) as { run?: PythonSandboxRun };
        setRun(payload.run ?? null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load run");
        setRun(null);
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      void loadRun();
    }
  }, [authLoading, user, runId, refreshIndex]);

  const timelineItems: TimelineItem[] = run
    ? [
        {
          title: "Queue",
          description: "Run entered the automation queue with persisted metadata.",
          status: run.status === "queued" ? "queued" : "completed",
          detail: formatTimestamp(run.created_at),
        },
        {
          title: "Execution",
          description:
            run.started_at
              ? "The execution worker picked up the run and began processing steps."
              : "Waiting for the execution worker to start processing.",
          status: run.status === "running" ? "running" : run.status === "completed" || run.status === "failed" || run.status === "canceled" ? "completed" : run.status === "awaiting_approval" ? "awaiting_approval" : "queued",
          detail: formatTimestamp(run.started_at),
        },
        {
          title: "Resolution",
          description:
            run.finished_at
              ? "Final result and evidence were written back to the run record."
              : "Final state is pending until the run finishes or is canceled.",
          status: run.finished_at ? (run.status === "failed" ? "failed" : "completed") : run.status,
          detail: formatTimestamp(run.finished_at),
        },
      ]
    : [];

  return (
    <ExecutiveModulePage pageModule={pageModule}>
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Automation run
            </p>
            <h2 className="text-2xl font-semibold tracking-tight">
              {run?.script_name || (runId ? `Run ${runId.slice(0, 8)}` : "Loading run")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Inspect status, guardrails, logs, and artifacts for a single execution record.
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

        {error && (
          <Card className="border-rose-500/20 bg-rose-500/5">
            <CardHeader>
              <CardTitle className="text-base">Run unavailable</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/dashboard/automation">Back to automation</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-border/70 bg-card/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardDescription>Status</CardDescription>
              <CardTitle className="text-2xl">{run ? formatStatusLabel(run.status) : "-"}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-border/70 bg-card/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardDescription>Risk</CardDescription>
              <CardTitle className="text-2xl">{run ? <RiskBadge level={run.risk_level} /> : "-"}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-border/70 bg-card/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardDescription>Runtime cap</CardDescription>
              <CardTitle className="text-2xl">{run ? `${run.max_runtime_seconds}s` : "-"}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-border/70 bg-card/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardDescription>Memory cap</CardDescription>
              <CardTitle className="text-2xl">{run ? `${run.max_memory_mb} MB` : "-"}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader className="border-b border-border/70">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">Execution details</CardTitle>
              {run && <Badge variant="outline" className={RUN_STATUS_CLASSES[run.status]}>{formatStatusLabel(run.status)}</Badge>}
            </div>
            <CardDescription>
              Inputs, runtime settings, and the source code that was queued for execution.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6 text-sm text-muted-foreground">
            {loading && !run ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : run ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border/70 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Requested by</p>
                    <p className="mt-2 text-foreground">{run.requested_by || "System"}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Approval</p>
                    <p className="mt-2 text-foreground">
                      {run.approval_required ? "Required before execution" : "Not required"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/70 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Network</p>
                    <p className="mt-2 text-foreground">{run.allow_network ? "Allowed" : "Disabled"}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Scopes</p>
                    <p className="mt-2 text-foreground">
                      {run.allowed_data_scopes.length > 0 ? run.allowed_data_scopes.join(", ") : "None"}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Input</p>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-foreground">
                    {JSON.stringify(run.input, null, 2)}
                  </pre>
                </div>

                <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Code</p>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-foreground">
                    {run.code}
                  </pre>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 px-4 py-10 text-center">
                <p className="text-sm text-muted-foreground">Run metadata will appear here once it loads.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <ApprovalPanel
            title="Approval decision"
            riskLevel={run?.risk_level || "medium"}
            state={run ? (run.approval_required ? "Awaiting approval or review" : "Approved to execute") : "Waiting for run data"}
            policy="Medium-risk or external-facing actions should stay gated until a named approver confirms them."
            bullets={[
              "High-risk runs require explicit approval before they can mutate external state.",
              "Capture evidence before and after mutating steps.",
              "Promote stable execution paths into reusable recipes.",
            ]}
          />

          <Card className="border-border/70 bg-card/80 shadow-sm">
            <CardHeader className="border-b border-border/70">
              <CardTitle className="text-base">Artifacts</CardTitle>
              <CardDescription>
                Files and outputs generated by this execution.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-6">
              {loading && !run ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : run && run.artifacts.length > 0 ? (
                run.artifacts.map((artifact) => (
                  <ArtifactPreviewCard
                    key={artifact.path}
                    title={artifact.name}
                    subtitle={artifact.content_type || "Generated artifact"}
                    lineage={artifact.path}
                    status="Stored"
                    details={[
                      artifact.size_bytes ? `${artifact.size_bytes} bytes` : "Unknown size",
                      "Persisted in run evidence",
                    ]}
                  />
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 px-4 py-8 text-sm text-muted-foreground">
                  No artifacts have been attached to this run yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <AutomationRunTimeline items={timelineItems} />
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader className="border-b border-border/70">
            <CardTitle className="text-base">Logs</CardTitle>
            <CardDescription>Standard output and error stream for the run.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6 text-sm">
            <div className="rounded-2xl border border-border/70 p-4">
              <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                Stdout
              </p>
              {run && run.stdout.length > 0 ? (
                <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-foreground">
                  {run.stdout.join("\n")}
                </pre>
              ) : (
                <p className="text-muted-foreground">No stdout captured.</p>
              )}
            </div>
            <div className="rounded-2xl border border-border/70 p-4">
              <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <PackageOpen className="h-3.5 w-3.5" />
                Stderr
              </p>
              {run && run.stderr.length > 0 ? (
                <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-foreground">
                  {run.stderr.join("\n")}
                </pre>
              ) : (
                <p className="text-muted-foreground">No stderr captured.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </ExecutiveModulePage>
  );
}
