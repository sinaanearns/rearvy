"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  CheckCircle2,
  CircleDot,
  Loader2,
  Monitor,
  Pause,
  Play,
  ShieldCheck,
  Square,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type DesktopWorkflowLog = {
  id?: string;
  stepId?: string;
  stepName?: string;
  action?: string;
  status?: string;
  durationMs?: number;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  result?: unknown;
};

type DesktopWorkflowState = {
  workflowId?: string | null;
  task?: string | null;
  description?: string | null;
  source?: string | null;
  currentStepName?: string | null;
  currentStepIndex?: number;
  nextStepName?: string | null;
  totalSteps?: number;
  completedSteps?: string[];
  state?: string;
  logs?: DesktopWorkflowLog[];
  errorCount?: number;
  startedAt?: string | null;
  completedAt?: string | null;
  updatedAt?: string | null;
  screenshotDataUrl?: string | null;
  error?: string | null;
  approval?: { reason?: string; requestedAt?: string } | null;
  steps?: Array<{ id?: string; name?: string; description?: string }>;
};

interface DesktopWorkspacePaneProps {
  sessionId: string;
  onClose: () => void;
  isOpen: boolean;
}

function asWorkflowState(value: unknown): DesktopWorkflowState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as DesktopWorkflowState;
}

function formatTime(value: string | null | undefined) {
  if (!value) {
    return "n/a";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "n/a";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getStatusClass(status: string) {
  if (status === "running") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }

  if (status === "pending-approval" || status === "paused") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }

  if (status === "completed") {
    return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
  }

  if (status === "failed" || status === "stopped" || status === "rejected") {
    return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300";
  }

  return "border-border bg-muted text-muted-foreground";
}

export function DesktopWorkspacePane({ onClose, isOpen }: DesktopWorkspacePaneProps) {
  const [state, setState] = useState<DesktopWorkflowState | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<"approve" | "reject" | "pause" | "resume" | "stop" | null>(null);
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  const refreshState = useCallback(async () => {
    const automation = window.electron?.automation;
    if (!automation?.getState) {
      setConnectionError("Desktop automation bridge is unavailable.");
      setLoading(false);
      return;
    }

    try {
      const nextState = asWorkflowState(await automation.getState());
      setState(nextState);
      setConnectionError(null);
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") {
      return;
    }

    setLoading(true);
    void refreshState();

    const unsubscribe = window.electron?.automation?.onStateChange?.((nextState: unknown) => {
      setState(asWorkflowState(nextState));
      setConnectionError(null);
      setLoading(false);
    });

    const handleBridgeReady = () => void refreshState();
    window.addEventListener("rearvy-electron-ready", handleBridgeReady as EventListener);
    window.addEventListener("focus", handleBridgeReady);

    return () => {
      unsubscribe?.();
      window.removeEventListener("rearvy-electron-ready", handleBridgeReady as EventListener);
      window.removeEventListener("focus", handleBridgeReady);
    };
  }, [isOpen, refreshState]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ block: "end" });
  }, [state?.logs]);

  const status = state?.state || "idle";
  const completedCount = state?.completedSteps?.length ?? 0;
  const totalSteps = state?.totalSteps ?? state?.steps?.length ?? 0;
  const progress = totalSteps > 0 ? Math.min(100, Math.round((completedCount / totalSteps) * 100)) : 0;
  const canApprove = status === "pending-approval" && Boolean(state?.workflowId);
  const canPause = status === "running";
  const canResume = status === "paused";
  const canStop = status === "running" || status === "paused" || status === "pending-approval";

  const visibleLogs = useMemo(() => {
    return (state?.logs ?? []).slice(-80);
  }, [state?.logs]);

  if (!isOpen) {
    return null;
  }

  const runAutomationAction = async (action: "pause" | "resume" | "stop") => {
    const automation = window.electron?.automation;
    const method = automation?.[action];

    if (!method) {
      setActionError(`Desktop automation bridge is unavailable for ${action}.`);
      return;
    }

    setActiveAction(action);
    setActionError(null);

    try {
      const result = await method();
      const resultRecord =
        result && typeof result === "object" ? (result as Record<string, unknown>) : null;
      if (resultRecord?.success === false || resultRecord?.ok === false) {
        const message =
          typeof resultRecord.error === "string"
            ? resultRecord.error
            : typeof resultRecord.reason === "string"
              ? resultRecord.reason
              : `Failed to ${action} workflow.`;
        throw new Error(message);
      }
      await refreshState();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setActiveAction(null);
    }
  };

  const approveWorkflow = async () => {
    const workflowId = state?.workflowId;
    const automation = window.electron?.automation;
    if (!workflowId || !automation?.approveWorkflow) {
      setActionError("Desktop workflow approval is unavailable.");
      return;
    }

    setActiveAction("approve");
    setActionError(null);

    try {
      const result = await automation.approveWorkflow(workflowId);
      if (!result.success) {
        throw new Error(result.error || "Failed to approve workflow.");
      }
      await refreshState();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setActiveAction(null);
    }
  };

  const rejectWorkflow = async () => {
    const workflowId = state?.workflowId;
    const automation = window.electron?.automation;
    if (!workflowId || !automation?.rejectWorkflow) {
      setActionError("Desktop workflow rejection is unavailable.");
      return;
    }

    setActiveAction("reject");
    setActionError(null);

    try {
      const result = await automation.rejectWorkflow(workflowId, "Rejected from Desktop Workspace.");
      if (!result.success) {
        throw new Error(result.error || "Failed to reject workflow.");
      }
      await refreshState();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col border-l border-border/70 bg-background/95 backdrop-blur-xl lg:w-[450px] xl:w-[550px]",
        "fixed inset-y-0 right-0 z-50 lg:relative lg:inset-auto"
      )}
    >
      <div className="flex items-center justify-between border-b border-border/70 p-4">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500">
            <Monitor className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-foreground">Desktop Workspace</h2>
            <p className="truncate text-[11px] text-muted-foreground">Approval-gated screen, mouse, and keyboard control</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full hover:bg-muted">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Connecting to desktop automation...
          </div>
        ) : null}

        {!loading && connectionError ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{connectionError}</span>
            </div>
          </div>
        ) : null}

        {!loading && !connectionError && !state ? (
          <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
            <div className="max-w-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500">
                <Monitor className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground">No active desktop workflow</h3>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Ask chat for a desktop action and the workflow will appear here before it can control the device.
              </p>
            </div>
          </div>
        ) : null}

        {state ? (
          <div className="space-y-4">
            <section className="rounded-xl border border-border bg-card/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-foreground">{state.task || "Desktop Workflow"}</h3>
                    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", getStatusClass(status))}>
                      <CircleDot className="h-3 w-3" />
                      {status}
                    </span>
                  </div>
                  {state.description ? (
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{state.description}</p>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{completedCount}/{totalSteps} steps</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-violet-500 transition-[width]" style={{ width: `${progress}%` }} />
                </div>
              </div>

              <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
                  Current: <span className="text-foreground">{state.currentStepName || "n/a"}</span>
                </div>
                <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
                  Updated: <span className="text-foreground">{formatTime(state.updatedAt)}</span>
                </div>
              </div>
            </section>

            {canApprove ? (
              <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">Approval required</h3>
                    <p className="mt-1 text-xs leading-5 text-amber-800 dark:text-amber-200">
                      {state.approval?.reason || "Approve this workflow before Rearvy controls your OS."}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" className="h-9 bg-emerald-600 text-white hover:bg-emerald-700" onClick={approveWorkflow} disabled={activeAction !== null}>
                        {activeAction === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Approve
                      </Button>
                      <Button type="button" variant="outline" className="h-9" onClick={rejectWorkflow} disabled={activeAction !== null}>
                        {activeAction === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            <section className="rounded-xl border border-border bg-card/70 p-4">
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="h-9" onClick={() => void runAutomationAction("pause")} disabled={!canPause || activeAction !== null}>
                  {activeAction === "pause" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
                  Pause
                </Button>
                <Button type="button" variant="outline" className="h-9" onClick={() => void runAutomationAction("resume")} disabled={!canResume || activeAction !== null}>
                  {activeAction === "resume" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Resume
                </Button>
                <Button type="button" variant="destructive" className="h-9" onClick={() => void runAutomationAction("stop")} disabled={!canStop || activeAction !== null}>
                  {activeAction === "stop" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
                  Stop
                </Button>
              </div>

              {actionError || state.error ? (
                <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-200">
                  {actionError || state.error}
                </div>
              ) : null}
            </section>

            {state.screenshotDataUrl ? (
              <section className="rounded-xl border border-border bg-card/70 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={state.screenshotDataUrl} alt="Desktop screenshot" className="max-h-72 w-full rounded-lg object-contain" />
              </section>
            ) : null}

            <section className="rounded-xl border border-border bg-card/70 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">Steps</h3>
                <span className="text-xs text-muted-foreground">{totalSteps} total</span>
              </div>
              <div className="space-y-2">
                {(state.steps ?? []).map((step, index) => {
                  const isDone = Boolean(step.id && state.completedSteps?.includes(step.id));
                  const isCurrent = index === state.currentStepIndex;
                  return (
                    <div key={step.id || index} className={cn("rounded-lg border px-3 py-2 text-xs", isCurrent ? "border-violet-500/40 bg-violet-500/10" : "border-border bg-background/50")}>
                      <div className="flex items-center gap-2">
                        {isDone ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <CircleDot className="h-3.5 w-3.5 text-muted-foreground" />}
                        <span className="font-medium text-foreground">{step.name || `Step ${index + 1}`}</span>
                      </div>
                      {step.description ? <p className="mt-1 pl-5 text-muted-foreground">{step.description}</p> : null}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-xl border border-border bg-[#101214] p-3">
              <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                <span>{visibleLogs.length} log entries</span>
                <span>Started {formatTime(state.startedAt)}</span>
              </div>
              <div className="max-h-56 overflow-auto font-mono text-[11px] leading-5">
                {visibleLogs.length === 0 ? (
                  <div className="text-slate-500">Waiting for workflow output.</div>
                ) : (
                  visibleLogs.map((log, index) => (
                    <div key={log.id || index} className="border-b border-white/[0.05] py-1.5">
                      <div className="flex flex-wrap gap-2">
                        <span className={cn("uppercase", log.status === "failed" ? "text-red-300" : log.status === "success" ? "text-emerald-300" : "text-slate-300")}>
                          {log.status || "info"}
                        </span>
                        <span className="text-slate-500">{log.stepName || log.stepId || "workflow"}</span>
                        {typeof log.durationMs === "number" ? <span className="text-slate-600">{log.durationMs}ms</span> : null}
                      </div>
                      {log.errorMessage ? <div className="mt-1 text-red-300">{log.errorMessage}</div> : null}
                      {typeof log.result === "string" && log.result ? <div className="mt-1 text-slate-300">{log.result}</div> : null}
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default DesktopWorkspacePane;
