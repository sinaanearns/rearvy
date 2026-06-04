"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  CheckCircle2,
  CircleDot,
  Copy,
  Download,
  Loader2,
  Monitor,
  Pause,
  Play,
  ShieldCheck,
  Square,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  steps?: Array<{
    id?: string;
    name?: string;
    description?: string;
    action?: Record<string, unknown>;
  }>;
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function truncateText(value: string, limit = 180) {
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length > limit
    ? `${normalized.slice(0, limit - 3)}...`
    : normalized;
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.round(value);
    }
  }

  return null;
}

function formatPoint(x: unknown, y: unknown) {
  const nextX = firstNumber(x);
  const nextY = firstNumber(y);
  return nextX !== null && nextY !== null ? `${nextX},${nextY}` : "";
}

function formatLogResult(result: unknown) {
  if (typeof result === "string") {
    return result.trim();
  }

  const record = asRecord(result);
  if (record) {
    const stdout = firstString(record.stdout);
    const stderr = firstString(record.stderr);
    const exitCode =
      typeof record.exitCode === "number" ? `exit ${record.exitCode}` : "";
    const parts = [
      exitCode,
      stdout,
      stderr ? `stderr: ${stderr}` : "",
    ].filter(Boolean);
    if (parts.length > 0) {
      return parts.join("\n");
    }
  }

  if (result == null) {
    return "";
  }

  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}

function formatWorkflowActionDetail(action: Record<string, unknown> | null | undefined) {
  if (!action) {
    return "";
  }

  const type = firstString(action.type) || "action";
  const point = formatPoint(action.x, action.y);
  const dragFrom = formatPoint(action.fromX, action.fromY);
  const dragTo = formatPoint(action.toX ?? action.x, action.toY ?? action.y);

  if (type === "click") {
    const button = firstString(action.button) || "left";
    return [
      "click",
      point ? `at ${point}` : "",
      button !== "left" ? button : "",
      action.double === true ? "double" : "",
    ].filter(Boolean).join(" ");
  }

  if (type === "clickElement") {
    const label = truncateText(firstString(action.text, action.label, action.target) || "element", 80);
    const controlType = firstString(action.controlType);
    const button = firstString(action.button) || "left";
    return [
      "clickElement",
      `"${label}"`,
      controlType ? `(${controlType})` : "",
      button !== "left" ? button : "",
      action.double === true ? "double" : "",
    ].filter(Boolean).join(" ");
  }

  if (type === "moveMouse") {
    return ["moveMouse", point ? `to ${point}` : ""].filter(Boolean).join(" ");
  }

  if (type === "dragMouse") {
    return [
      "dragMouse",
      dragFrom ? `from ${dragFrom}` : "",
      dragTo ? `to ${dragTo}` : "",
      firstString(action.button) ? `(${firstString(action.button)})` : "",
    ].filter(Boolean).join(" ");
  }

  if (type === "mouseDown" || type === "mouseUp") {
    return [type, firstString(action.button) || "left"].filter(Boolean).join(" ");
  }

  if (type === "scroll") {
    return [
      "scroll",
      firstString(action.direction) || "down",
      firstNumber(action.amount) ?? "",
    ].filter((item) => item !== "").join(" ");
  }

  if (type === "setClipboard") {
    return `setClipboard -> ${truncateText(firstString(action.text) || "text", 80)}`;
  }

  if (type === "getClipboard") {
    return "getClipboard";
  }

  if (type === "type") {
    return `type -> ${truncateText(firstString(action.text) || "text", 80)}`;
  }

  if (type === "closeWindow") {
    return action.force === true ? "closeWindow (force)" : "closeWindow";
  }

  if (type === "focusWindow") {
    const target = firstString(action.windowTitle, action.title, action.name, action.target);
    return ["focusWindow", target ? `-> ${target}` : ""].filter(Boolean).join(" ");
  }

  if (type === "listWindows") {
    return "listWindows -> open windows";
  }

  if (type === "readVisibleText") {
    const limit = firstString(action.maxTextItems, action.maxElements, action.maxItems);
    return ["readVisibleText", limit ? `(limit ${limit})` : ""].filter(Boolean).join(" ");
  }

  if (type === "getElementState") {
    const target = firstString(action.text, action.label, action.name, action.target);
    const controlType = firstString(action.controlType, action.role, action.kind);
    return ["getElementState", target ? `-> ${target}` : "", controlType ? `(${controlType})` : ""]
      .filter(Boolean)
      .join(" ");
  }

  if (type === "getElementValue") {
    const target = firstString(action.text, action.label, action.name, action.target);
    const controlType = firstString(action.controlType, action.role, action.kind);
    return ["getElementValue", target ? `-> ${target}` : "", controlType ? `(${controlType})` : ""]
      .filter(Boolean)
      .join(" ");
  }

  if (type === "invokeElement") {
    const target = firstString(action.text, action.label, action.name, action.target);
    const controlType = firstString(action.controlType, action.role, action.kind);
    return ["invokeElement", target ? `-> ${target}` : "", controlType ? `(${controlType})` : ""]
      .filter(Boolean)
      .join(" ");
  }

  if (type === "listUiElements") {
    const filter = firstString(action.controlType, action.role, action.kind);
    const limit = firstString(action.maxElements, action.maxItems, action.maxEntries);
    return ["listUiElements", filter ? `-> ${filter}` : "", limit ? `(limit ${limit})` : ""]
      .filter(Boolean)
      .join(" ");
  }

  if (type === "typeIntoElement") {
    const target = firstString(action.text, action.label, action.name, action.target);
    const value = firstString(action.value, action.textToType, action.input, action.content);
    return ["typeIntoElement", target ? `-> ${target}` : "", value ? `(${value.length} chars)` : ""]
      .filter(Boolean)
      .join(" ");
  }

  if (type === "setElementValue") {
    const target = firstString(action.text, action.label, action.name, action.target);
    const value = firstString(action.value, action.textToSet, action.input, action.content);
    return ["setElementValue", target ? `-> ${target}` : "", value ? `(${value.length} chars)` : ""]
      .filter(Boolean)
      .join(" ");
  }

  if (type === "selectOption") {
    const option = firstString(action.option, action.value, action.optionText, action.selection);
    const target = firstString(action.text, action.label, action.name, action.target);
    return ["selectOption", option ? `-> ${option}` : "", target ? `(${target})` : ""]
      .filter(Boolean)
      .join(" ");
  }

  if (type === "setToggleState") {
    const target = firstString(action.text, action.label, action.name, action.target);
    const state = firstString(action.state, action.checked, action.value, action.mode);
    return ["setToggleState", target ? `-> ${target}` : "", state ? `(${state})` : ""]
      .filter(Boolean)
      .join(" ");
  }

  if (type === "waitForElement") {
    const target = firstString(action.text, action.label, action.name, action.target);
    const controlType = firstString(action.controlType, action.role, action.kind);
    return ["waitForElement", target ? `-> ${target}` : "", controlType ? `(${controlType})` : ""]
      .filter(Boolean)
      .join(" ");
  }

  if (type === "setWindowState") {
    const state = firstString(action.state, action.windowState, action.mode, action.targetState);
    const target = firstString(action.windowTitle, action.title, action.name, action.target);
    return ["setWindowState", state ? `-> ${state}` : "", target ? `(${target})` : ""]
      .filter(Boolean)
      .join(" ");
  }

  if (type === "copyPath" || type === "movePath") {
    const source = firstString(action.sourcePath, action.fromPath, action.path, action.filePath, action.directoryPath);
    const destination = firstString(action.destinationPath, action.toPath, action.target);
    const flags = [
      action.overwrite === true || action.force === true ? "overwrite" : "",
      action.reveal === true ||
      action.revealAfterCopy === true ||
      action.revealAfterMove === true
        ? "reveal"
        : "",
      action.open === true ||
      action.openAfterCopy === true ||
      action.openAfterMove === true
        ? "open"
        : "",
    ].filter(Boolean);

    return [
      type,
      source && destination
        ? `-> ${source} -> ${destination}`
        : source
          ? `-> ${source}`
          : destination
            ? `-> ${destination}`
            : "",
      flags.length ? `(${flags.join(", ")})` : "",
    ].filter(Boolean).join(" ");
  }

  if (type === "trashPath") {
    const target = firstString(
      action.path,
      action.filePath,
      action.directoryPath,
      action.target,
      action.sourcePath,
      action.fromPath
    );
    return ["trashPath", target ? `-> ${target}` : ""].filter(Boolean).join(" ");
  }

  if (type === "appendToFile") {
    const target = firstString(action.path, action.filePath, action.target);
    const content = firstString(action.content, action.text, action.append, action.value);
    const flags = [
      action.backup === false ? "no backup" : "",
      action.newline === false || action.appendNewline === false ? "raw" : "newline",
      action.reveal === true ||
      action.revealAfterAppend === true ||
      action.revealAfterWrite === true
        ? "reveal"
        : "",
      action.open === true ||
      action.openAfterAppend === true ||
      action.openAfterWrite === true
        ? "open"
        : "",
    ].filter(Boolean);

    return [
      "appendToFile",
      target ? `-> ${target}` : "",
      content ? `+"${truncateText(content, 40)}"` : "",
      flags.length ? `(${flags.join(", ")})` : "",
    ].filter(Boolean).join(" ");
  }

  if (type === "replaceInFile") {
    const target = firstString(action.path, action.filePath, action.target);
    const search = firstString(action.search, action.find, action.oldText, action.fromText);
    const replacement = firstString(action.replacement, action.replaceWith, action.newText, action.toText);
    const flags = [
      action.backup === false ? "no backup" : "",
      action.all === true || action.replaceAll === true ? "all" : "",
      action.reveal === true ||
      action.revealAfterReplace === true ||
      action.revealAfterWrite === true
        ? "reveal"
        : "",
      action.open === true ||
      action.openAfterReplace === true ||
      action.openAfterWrite === true
        ? "open"
        : "",
    ].filter(Boolean);

    return [
      "replaceInFile",
      target ? `-> ${target}` : "",
      search ? `"${truncateText(search, 40)}" -> "${truncateText(replacement ?? "", 40)}"` : "",
      flags.length ? `(${flags.join(", ")})` : "",
    ].filter(Boolean).join(" ");
  }

  const target = firstString(
    action.appPath,
    action.target,
    action.path,
    action.filePath,
    action.directoryPath,
    action.command,
    action.key,
    action.text
  );
  const flags = action.type === "writeFile"
    ? [
        action.backup === false ? "no backup" : "",
        action.reveal === true || action.revealAfterWrite === true ? "reveal" : "",
        action.open === true || action.openAfterWrite === true ? "open" : "",
      ].filter(Boolean)
    : [];

  return [
    type,
    target ? `-> ${target}` : "",
    flags.length ? `(${flags.join(", ")})` : "",
  ].filter(Boolean).join(" ");
}

function buildWorkflowReport(state: DesktopWorkflowState) {
  const lines = [
    `Workflow: ${state.task || "Desktop Workflow"}`,
    `Status: ${state.state || "unknown"}`,
    state.description ? `Description: ${state.description}` : "",
    state.workflowId ? `Workflow ID: ${state.workflowId}` : "",
    `Steps: ${state.completedSteps?.length ?? 0}/${state.totalSteps ?? state.steps?.length ?? 0}`,
    state.startedAt ? `Started: ${state.startedAt}` : "",
    state.completedAt ? `Completed: ${state.completedAt}` : "",
    state.error ? `Error: ${state.error}` : "",
    "",
    "Step plan:",
    ...(state.steps ?? []).map((step, index) => {
      const done = step.id && state.completedSteps?.includes(step.id) ? "done" : "pending";
      const actionDetail = formatWorkflowActionDetail(step.action);
      return `${index + 1}. [${done}] ${step.name || step.id || "Step"}${step.description ? ` - ${step.description}` : ""}${actionDetail ? `\n   ${actionDetail}` : ""}`;
    }),
    "",
    "Logs:",
    ...(state.logs ?? []).map((log, index) => {
      const result = formatLogResult(log.result);
      return [
        `${index + 1}. ${log.status || "info"} ${log.stepName || log.stepId || "workflow"}${typeof log.durationMs === "number" ? ` (${log.durationMs}ms)` : ""}`,
        log.errorMessage ? `Error: ${log.errorMessage}` : "",
        result ? `Result:\n${result}` : "",
      ].filter(Boolean).join("\n");
    }),
  ].filter((line) => line !== "");

  return lines.join("\n");
}

function downloadDataUrl(dataUrl: string, fileName: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function downloadTextFile(text: string, fileName: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    downloadDataUrl(url, fileName);
  } finally {
    URL.revokeObjectURL(url);
  }
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

  const copyLogResult = useCallback(async (value: string) => {
    if (!value.trim()) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      toast.success("Workflow output copied.");
    } catch {
      toast.error("Failed to copy workflow output.");
    }
  }, []);

  const copyWorkflowReport = useCallback(async () => {
    if (!state) {
      return;
    }

    try {
      await navigator.clipboard.writeText(buildWorkflowReport(state));
      toast.success("Workflow report copied.");
    } catch {
      toast.error("Failed to copy workflow report.");
    }
  }, [state]);

  const downloadWorkflowReport = useCallback(() => {
    if (!state) {
      return;
    }

    const workflowId = state.workflowId || "workflow";
    downloadTextFile(buildWorkflowReport(state), `rearvy-${workflowId}-report.txt`);
    toast.success("Workflow report downloaded.");
  }, [state]);

  const downloadScreenshot = useCallback(() => {
    const currentState = state;
    if (!currentState) {
      return;
    }

    const dataUrl = currentState?.screenshotDataUrl;
    if (!dataUrl?.startsWith("data:image/")) {
      toast.error("No workflow screenshot is available.");
      return;
    }

    const workflowId = currentState?.workflowId || "workflow";
    downloadDataUrl(dataUrl, `rearvy-${workflowId}-screenshot.png`);
    toast.success("Workflow screenshot downloaded.");
  }, [state]);

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
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-violet-500/10 text-violet-500">
            <Monitor className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-foreground">Desktop Workspace</h2>
            <p className="truncate text-[11px] text-muted-foreground">Approval-gated screen, mouse, and keyboard control</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-[8px] hover:bg-muted">
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
          <div className="rounded-[8px] border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{connectionError}</span>
            </div>
          </div>
        ) : null}

        {!loading && !connectionError && !state ? (
          <div className="flex min-h-[320px] items-center justify-center rounded-[8px] border border-dashed border-border bg-muted/30 p-6 text-center">
            <div className="max-w-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[8px] bg-violet-500/10 text-violet-500">
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
            <section className="rounded-[8px] border border-border bg-card/70 p-4 shadow-sm shadow-slate-950/[0.03]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-foreground">{state.task || "Desktop Workflow"}</h3>
                    <span className={cn("inline-flex items-center gap-1 rounded-[8px] border px-2 py-0.5 text-[11px] font-medium", getStatusClass(status))}>
                      <CircleDot className="h-3 w-3" />
                      {status}
                    </span>
                  </div>
                  {state.description ? (
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{state.description}</p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void copyWorkflowReport()}
                  className="h-8 shrink-0 rounded-[8px]"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy report
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={downloadWorkflowReport}
                  className="h-8 shrink-0 rounded-[8px]"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download report
                </Button>
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
                <div className="rounded-[8px] border border-border bg-background/60 px-3 py-2">
                  Current: <span className="text-foreground">{state.currentStepName || "n/a"}</span>
                </div>
                <div className="rounded-[8px] border border-border bg-background/60 px-3 py-2">
                  Updated: <span className="text-foreground">{formatTime(state.updatedAt)}</span>
                </div>
              </div>
            </section>

            {canApprove ? (
              <section className="rounded-[8px] border border-amber-500/30 bg-amber-500/10 p-4 shadow-sm shadow-amber-950/[0.03]">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">Approval required</h3>
                    <p className="mt-1 text-xs leading-5 text-amber-800 dark:text-amber-200">
                      {state.approval?.reason || "Approve this workflow before Rearvy controls your OS."}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" className="h-9 rounded-[8px] bg-emerald-600 text-white hover:bg-emerald-700" onClick={approveWorkflow} disabled={activeAction !== null}>
                        {activeAction === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Approve
                      </Button>
                      <Button type="button" variant="outline" className="h-9 rounded-[8px]" onClick={rejectWorkflow} disabled={activeAction !== null}>
                        {activeAction === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            <section className="rounded-[8px] border border-border bg-card/70 p-4 shadow-sm shadow-slate-950/[0.03]">
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="h-9 rounded-[8px]" onClick={() => void runAutomationAction("pause")} disabled={!canPause || activeAction !== null}>
                  {activeAction === "pause" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
                  Pause
                </Button>
                <Button type="button" variant="outline" className="h-9 rounded-[8px]" onClick={() => void runAutomationAction("resume")} disabled={!canResume || activeAction !== null}>
                  {activeAction === "resume" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Resume
                </Button>
                <Button type="button" variant="destructive" className="h-9 rounded-[8px]" onClick={() => void runAutomationAction("stop")} disabled={!canStop || activeAction !== null}>
                  {activeAction === "stop" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
                  Stop
                </Button>
              </div>

              {actionError || state.error ? (
                <div className="mt-3 rounded-[8px] border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-200">
                  {actionError || state.error}
                </div>
              ) : null}
            </section>

            {state.screenshotDataUrl ? (
              <section className="rounded-[8px] border border-border bg-card/70 p-2 shadow-sm shadow-slate-950/[0.03]">
                <div className="mb-2 flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-[8px]"
                    onClick={downloadScreenshot}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download screenshot
                  </Button>
                </div>
                <Image
                  src={state.screenshotDataUrl}
                  alt="Desktop screenshot"
                  width={960}
                  height={540}
                  unoptimized
                  className="max-h-72 w-full rounded-[8px] object-contain"
                />
              </section>
            ) : null}

            <section className="rounded-[8px] border border-border bg-card/70 p-4 shadow-sm shadow-slate-950/[0.03]">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">Steps</h3>
                <span className="text-xs text-muted-foreground">{totalSteps} total</span>
              </div>
              <div className="space-y-2">
                {(state.steps ?? []).map((step, index) => {
                  const isDone = Boolean(step.id && state.completedSteps?.includes(step.id));
                  const isCurrent = index === state.currentStepIndex;
                  const actionDetail = formatWorkflowActionDetail(step.action);
                  return (
                    <div key={step.id || index} className={cn("rounded-[8px] border px-3 py-2 text-xs", isCurrent ? "border-violet-500/40 bg-violet-500/10" : "border-border bg-background/50")}>
                      <div className="flex items-center gap-2">
                        {isDone ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <CircleDot className="h-3.5 w-3.5 text-muted-foreground" />}
                        <span className="font-medium text-foreground">{step.name || `Step ${index + 1}`}</span>
                      </div>
                      {step.description ? <p className="mt-1 pl-5 text-muted-foreground">{step.description}</p> : null}
                      {actionDetail ? (
                        <div className="mt-1 ml-5 truncate rounded-[8px] bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
                          {actionDetail}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[8px] border border-border bg-[#101214] p-3 shadow-sm shadow-slate-950/[0.03]">
              <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                <span>{visibleLogs.length} log entries</span>
                <span>Started {formatTime(state.startedAt)}</span>
              </div>
              <div className="max-h-56 overflow-auto font-mono text-[11px] leading-5">
                {visibleLogs.length === 0 ? (
                  <div className="text-slate-500">Waiting for workflow output.</div>
                ) : (
                  visibleLogs.map((log, index) => {
                    const formattedResult = formatLogResult(log.result);
                    return (
                      <div key={log.id || index} className="border-b border-white/[0.05] py-1.5">
                        <div className="flex flex-wrap gap-2">
                          <span className={cn("uppercase", log.status === "failed" ? "text-red-300" : log.status === "success" ? "text-emerald-300" : "text-slate-300")}>
                            {log.status || "info"}
                          </span>
                          <span className="text-slate-500">{log.stepName || log.stepId || "workflow"}</span>
                          {typeof log.durationMs === "number" ? <span className="text-slate-600">{log.durationMs}ms</span> : null}
                        </div>
                        {log.errorMessage ? <div className="mt-1 text-red-300">{log.errorMessage}</div> : null}
                        {formattedResult ? (
                          <div className="group/result relative mt-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-1 top-1 h-6 w-6 rounded-[8px] bg-black/40 text-slate-300 opacity-0 hover:bg-black/70 hover:text-white group-hover/result:opacity-100"
                              onClick={() => void copyLogResult(formattedResult)}
                              aria-label="Copy workflow output"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-[8px] bg-black/20 p-2 pr-9 text-slate-300">
                              {formattedResult}
                            </pre>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
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
