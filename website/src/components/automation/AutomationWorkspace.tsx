"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Download, Plug, RefreshCw, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AWHeader } from "@/components/automation/components/AWHeader";
import { AWEditor } from "@/components/automation/components/AWEditor";
import { AWCurrentWork } from "@/components/automation/components/AWCurrentWork";
import { AWHistory } from "@/components/automation/components/AWHistory";
import { AWLiveOutput } from "@/components/automation/components/AWLiveOutput";
import type { AutomationEvent, AutomationEventType, AutomationStatus, AutomationTask, DesktopScope } from "@/components/automation/types";

type ElectronBridge = NonNullable<Window["electron"]>;
type ElectronBridgeWithWorkspace = ElectronBridge & {
  workspace?: {
    getScope: () => Promise<DesktopScope>;
    setScope: (scope: DesktopScope) => Promise<DesktopScope>;
    pickFolder: () => Promise<DesktopScope>;
  };
};

const HISTORY_KEY = "rearvy.automation.workspace.history.v1";
const SCOPE_KEY = "rearvy.automation.workspace.scope.v1";

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function readTimestamp(value: unknown, fallback = Date.now()) {
  if (typeof value !== "string") {
    return fallback;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : fallback;
}

function normalizeAutomationStatus(value: unknown): AutomationStatus {
  if (
    value === "idle" ||
    value === "planning" ||
    value === "running" ||
    value === "paused" ||
    value === "stopped" ||
    value === "error"
  ) {
    return value;
  }

  if (value === "failed") {
    return "error";
  }

  if (value === "completed") {
    return "stopped";
  }

  return "idle";
}

function getFirstHistoryCommand(record: Record<string, unknown>) {
  if (!Array.isArray(record.steps) || !isRecord(record.steps[0])) {
    return "";
  }

  const firstStep = record.steps[0];
  if (isRecord(firstStep.action)) {
    return readString(firstStep.action.command);
  }

  return readString(firstStep.command);
}

function normalizeHistoryTask(value: unknown): AutomationTask {
  const record = isRecord(value) ? value : {};
  const workflowId = readString(record.workflowId, readString(record.id, makeId()));
  const title = readString(
    record.name,
    readString(record.task, `Workflow ${readString(record.workflowId, readString(record.id))}`.trim())
  );
  const createdAt = readTimestamp(record.startedAt);

  return {
    id: workflowId,
    title,
    command: getFirstHistoryCommand(record),
    status: normalizeAutomationStatus(record.state),
    createdAt,
    updatedAt: readTimestamp(record.updatedAt, createdAt),
  };
}

function normalizeStateTask(value: unknown): AutomationTask {
  const record = isRecord(value) ? value : {};
  const workflowId = readString(record.workflowId, makeId());
  const state = normalizeAutomationStatus(record.state);

  return {
    id: workflowId,
    title: readString(record.task, workflowId || "Workflow"),
    command: readString(record.nextStepName),
    status: state,
    createdAt: readTimestamp(record.startedAt),
    updatedAt: Date.now(),
  };
}

function getElectronBridge(): ElectronBridgeWithWorkspace | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.electron as ElectronBridgeWithWorkspace | undefined;
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function safeReadHistory(): AutomationTask[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeHistoryTask) : [];
  } catch {
    return [];
  }
}

function persistHistory(tasks: AutomationTask[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(tasks.slice(0, 24)));
  } catch {
    // Ignore storage failures in restricted environments.
  }
}

function normalizeScope(scope: Partial<DesktopScope> | null | undefined): DesktopScope {
  const mode = scope?.mode === "full-access" ? "full-access" : scope?.mode === "bypass" ? "bypass" : "folder";
  const path = typeof scope?.path === "string" ? scope.path : "";

  return { mode, path };
}

function safeReadScope(): DesktopScope {
  if (typeof window === "undefined") {
    return { mode: "folder", path: "" };
  }

  try {
    const raw = window.localStorage.getItem(SCOPE_KEY);
    if (!raw) {
      return { mode: "folder", path: "" };
    }

    return normalizeScope(JSON.parse(raw) as Partial<DesktopScope>);
  } catch {
    return { mode: "folder", path: "" };
  }
}

function persistScope(scope: DesktopScope) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(SCOPE_KEY, JSON.stringify(scope));
  } catch {
    // Ignore storage failures in restricted environments.
  }
}

export function AutomationWorkspace() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [bridgeState, setBridgeState] = useState<"checking" | "browser" | "update-required" | "connecting" | "ready">("checking");
  const [status, setStatus] = useState<AutomationStatus>("idle");
  const [planDraft, setPlanDraft] = useState("Review recent work, run the next automation step in the background, and keep the user updated.");
  const [commandDraft, setCommandDraft] = useState("npm run dev");
  const [activeTask, setActiveTask] = useState<AutomationTask | null>(null);
  const [tasks, setTasks] = useState<AutomationTask[]>([]);
  const [events, setEvents] = useState<AutomationEvent[]>([]);
  const [commandOutput, setCommandOutput] = useState<string[]>([]);
  const [workingDirectory, setWorkingDirectory] = useState<string | null>(null);
  const [desktopScope, setDesktopScope] = useState<DesktopScope>({ mode: "folder", path: "" });
  const [bridgeLog, setBridgeLog] = useState<string[]>([]);
  const eventsEndRef = useRef<HTMLDivElement>(null);

  const electron = getElectronBridge();
  const automation = electron?.automation;
  const terminal = electron?.terminal;
  const workspace = electron?.workspace;
  const isDesktop = Boolean(electron);

  const timeline = useMemo(() => {
    return [...events].sort((left, right) => right.timestamp - left.timestamp);
  }, [events]);

  function pushEvent(type: AutomationEventType, title: string, detail: string) {
    const event = {
      id: makeId(),
      type,
      title,
      detail,
      timestamp: Date.now(),
    };

    setEvents((previous) => [event, ...previous].slice(0, 50));
    return event;
  }

  function updateTask(nextTask: AutomationTask) {
    setTasks((previous) => {
      const next = [nextTask, ...previous.filter((task) => task.id !== nextTask.id)].slice(0, 24);
      persistHistory(next);
      return next;
    });
    setActiveTask(nextTask);
  }

  function updateScope(nextScope: DesktopScope) {
    setDesktopScope(nextScope);
    persistScope(nextScope);

    if (workspace?.setScope) {
      void workspace.setScope(nextScope).catch((error: unknown) => {
        if (isDesktop) {
          setBridgeLog((previous) => [...previous.slice(-4), `scope sync failed: ${error instanceof Error ? error.message : String(error)}`]);
        }
      });
    }

    const label = nextScope.mode === "full-access"
      ? "Full desktop access enabled"
      : nextScope.mode === "bypass"
        ? "Bypass desktop access enabled"
        : nextScope.path
          ? `Scoped to ${nextScope.path}`
          : "Scoped folder not set";

    pushEvent("system", "Desktop scope updated", label);
  }

  function useCurrentWorkingDirectory() {
    if (!workingDirectory) {
      pushEvent("error", "No working directory", "Open a project or folder first to use it as the scope.");
      return;
    }

    updateScope({ mode: "folder", path: workingDirectory });
  }

  function useFullDesktopAccess() {
    updateScope({ mode: "full-access", path: desktopScope.path || workingDirectory || "" });
  }

  async function chooseScopeFolder() {
    if (workspace?.pickFolder) {
      try {
        const scope = await workspace.pickFolder();
        if (scope?.path) {
          updateScope(scope);
        }
        return;
      } catch (error) {
        pushEvent("error", "Folder picker failed", error instanceof Error ? error.message : String(error));
      }
    }

    if (workingDirectory) {
      updateScope({ mode: "folder", path: workingDirectory });
    }
  }

  const checkElectron = async () => {
    const hasWindow = typeof window !== "undefined";
    const currentElectron = hasWindow ? getElectronBridge() : undefined;
    const hasElectron = Boolean(currentElectron);
    const hasTerminal = Boolean(currentElectron?.terminal);
    const hasAutomation = Boolean(currentElectron?.automation);

    if (isDesktop) {
      setBridgeLog((previous) => [
        ...previous.slice(-4),
        `[${new Date().toLocaleTimeString()}] bridge T:${String(hasTerminal)} A:${String(hasAutomation)}`,
      ]);
    }

    if (!hasElectron) {
      setIsAvailable(false);
      setBridgeState("browser");
      return null;
    }

    if (hasTerminal || hasAutomation) {
      setIsAvailable(true);
      setBridgeState("ready");

      if (hasAutomation && currentElectron?.automation?.getState) {
        try {
          const state = await currentElectron.automation.getState();
          if (isRecord(state) && typeof state.workflowId === "string") {
            pushEvent("system", "Current work detected", `Workflow ${state.workflowId} is ${readString(state.state, "unknown")}.`);
            setStatus(normalizeAutomationStatus(state.state));
          }
        } catch (error) {
          if (isDesktop) {
            setBridgeLog((previous) => [...previous.slice(-4), `automation state check failed: ${error instanceof Error ? error.message : String(error)}`]);
          }
        }
      }

      return () => undefined;
    }

    setIsAvailable(false);
    setBridgeState("update-required");
    return null;
  };

  useEffect(() => {
    setTasks(safeReadHistory());
    setDesktopScope(safeReadScope());
  }, []);

  useEffect(() => {
    if (!workspace?.getScope) {
      return;
    }

    let mounted = true;

    (async () => {
      try {
        const scope = await workspace.getScope();
        if (mounted && scope) {
          const nextScope = normalizeScope(scope as Partial<DesktopScope>);
          setDesktopScope(nextScope);
          persistScope(nextScope);
        }
      } catch (error) {
        if (isDesktop) {
          setBridgeLog((previous) => [...previous.slice(-4), `scope load failed: ${error instanceof Error ? error.message : String(error)}`]);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [workspace]);

  useEffect(() => {
    let cleanup: (() => void) | null = null;
    let retryInterval: ReturnType<typeof setInterval> | null = null;
    let checking = false;
    let connected = false;

    const attempt = () => {
      if (checking || connected) {
        return;
      }

      checking = true;
      void checkElectron()
        .then((result) => {
          checking = false;
          if (result) {
            connected = true;
            cleanup = result;
            if (retryInterval) {
              clearInterval(retryInterval);
              retryInterval = null;
            }
          }
        })
        .catch((error) => {
          checking = false;
          setBridgeState("connecting");
          if (isDesktop) {
            setBridgeLog((previous) => [...previous.slice(-4), `[${new Date().toLocaleTimeString()}] bridge check failed: ${error instanceof Error ? error.message : String(error)}`]);
          }
        });
    };

    attempt();
    retryInterval = setInterval(attempt, 800);

    const handleBridgeReady = () => attempt();

    window.addEventListener("rearvy-electron-ready", handleBridgeReady as EventListener);
    window.addEventListener("focus", handleBridgeReady);

    return () => {
      if (retryInterval) {
        clearInterval(retryInterval);
      }
      cleanup?.();
      window.removeEventListener("rearvy-electron-ready", handleBridgeReady as EventListener);
      window.removeEventListener("focus", handleBridgeReady);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const unsubscribe = electron?.onOpenPath?.((payload: { cwd?: string; path?: string; kind?: string }) => {
      setWorkingDirectory(payload.cwd ?? null);
      pushEvent("system", "Project opened", `${payload.kind ?? "item"} ${payload.path ?? ""}`.trim());
    });

    return () => {
      unsubscribe?.();
    };
  }, [electron]);

  // Load history from the desktop bridge (if available) and subscribe to automation state changes
  useEffect(() => {
    if (!automation) return;

    let mounted = true;

    (async () => {
      try {
        const remoteHistory = await automation.getHistory?.();
        if (mounted && Array.isArray(remoteHistory)) {
          const mapped = remoteHistory
            .slice()
            .reverse()
            .map(normalizeHistoryTask);

          setTasks((prev) => {
            const merged = [...mapped, ...prev].slice(0, 24);
            persistHistory(merged);
            return merged;
          });
        }
      } catch (err) {
        pushEvent("error", "Failed to load history", err instanceof Error ? err.message : String(err));
      }
    })();

    const unsubState = automation.onStateChange?.((state: unknown) => {
      const task = normalizeStateTask(state);
      const stateLabel = isRecord(state) ? readString(state.state, task.status) : task.status;
      pushEvent("system", "State change", `Workflow ${task.id} is ${stateLabel}`);
      setStatus(task.status);

      updateTask(task);
    });

    const unsubPaused = automation.onPaused?.(() => {
      setStatus("paused");
      pushEvent("system", "Paused", "Automation paused by the runtime");
    });

    const unsubResumed = automation.onResumed?.(() => {
      setStatus("running");
      pushEvent("system", "Resumed", "Automation resumed by the runtime");
    });

    const unsubStopped = automation.onStopped?.(() => {
      setStatus("stopped");
      pushEvent("system", "Stopped", "Automation stopped by the runtime");
    });

    return () => {
      mounted = false;
      unsubState?.();
      unsubPaused?.();
      unsubResumed?.();
      unsubStopped?.();
    };
  }, [automation]);

  useEffect(() => {
    if (!terminal?.onOutput || !terminal?.onStatusChange) {
      return;
    }

    const cleanupOutput = terminal.onOutput((output: { type?: string; data?: string }) => {
      if (typeof output.data === "string") {
        const line: string = output.data;
        setCommandOutput((previous: string[]) => [...previous, line].slice(-60));
      }
    });

    const cleanupStatus = terminal.onStatusChange((nextStatus: { status?: string; code?: number }) => {
      if (!nextStatus.status) {
        return;
      }

      const normalizedStatus = normalizeAutomationStatus(nextStatus.status);
      setStatus(normalizedStatus);
      if (nextStatus.status === "stopped") {
        pushEvent("result", "Background work stopped", `Exit code ${nextStatus.code ?? "unknown"}`);
      } else if (nextStatus.status === "error") {
        pushEvent("error", "Background work failed", `Exit code ${nextStatus.code ?? "unknown"}`);
      }
    });

    return () => {
      cleanupOutput();
      cleanupStatus();
    };
  }, [terminal]);

  useEffect(() => {
    if (eventsEndRef.current) {
      eventsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [events]);

  async function handleStartPlan(event?: React.FormEvent) {
    event?.preventDefault();
    if (!isAvailable || !planDraft.trim() || !commandDraft.trim()) {
      return;
    }

    const nextTask: AutomationTask = {
      id: makeId(),
      title: planDraft.trim(),
      command: commandDraft.trim(),
      status: "running",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    pushEvent("plan", "Plan queued", nextTask.title);
    pushEvent("command", "Command prepared", nextTask.command);
    setStatus("planning");
    setCommandOutput([]);

    updateTask(nextTask);

    try {
      if (automation?.startWorkflow) {
        await automation.startWorkflow({
          id: nextTask.id,
          name: nextTask.title,
          type: "automation",
          state: "draft",
          steps: [
            {
              id: `${nextTask.id}-step-1`,
              name: nextTask.title,
              action: {
                type: "shell",
                command: nextTask.command,
              },
            },
          ],
        });
      }

      if (terminal?.runCommand) {
        const response = await terminal.runCommand({ command: nextTask.command, cwd: workingDirectory ?? undefined });
        if (!response?.success) {
          setStatus("error");
          pushEvent("error", "Failed to start background work", response?.error ?? "Unknown error");
          return;
        }
      }

      setStatus("running");
      pushEvent("system", "Background work running", `Working directory: ${workingDirectory ?? "default"}`);
      setCommandDraft("");
    } catch (error) {
      setStatus("error");
      pushEvent("error", "Automation start failed", error instanceof Error ? error.message : String(error));
    }
  }

  async function handlePause() {
    if (!automation?.pause) {
      return;
    }

    await automation.pause();
    setStatus("paused");
    if (activeTask) {
      updateTask({ ...activeTask, status: "paused", updatedAt: Date.now() });
    }
    pushEvent("edit", "Paused for edits", "The next instruction can now be revised.");
  }

  async function handleResume() {
    if (!automation?.resume) {
      return;
    }

    await automation.resume();
    setStatus("running");
    if (activeTask) {
      updateTask({ ...activeTask, status: "running", updatedAt: Date.now() });
    }
    pushEvent("system", "Resumed", "The background automation continued.");
  }

  async function handleStop() {
    try {
      if (automation?.stop) {
        await automation.stop();
      }

      if (activeTask) {
        updateTask({ ...activeTask, status: "stopped", updatedAt: Date.now() });
      }

      setStatus("stopped");
      pushEvent("result", "Stopped", "The active work was stopped by the user.");
    } catch (error) {
      setStatus("error");
      pushEvent("error", "Stop failed", error instanceof Error ? error.message : String(error));
    }
  }

  function handleApplyEdit() {
    if (!planDraft.trim()) {
      return;
    }

    pushEvent("edit", "Plan edited", planDraft.trim());
    if (activeTask) {
      updateTask({ ...activeTask, title: planDraft.trim(), updatedAt: Date.now() });
    }
  }

  function handleOpenExternal() {
    void terminal?.openExternal?.(workingDirectory ?? undefined);
  }

  function handleRetryBridge() {
    setBridgeState("checking");
    void checkElectron();
  }

  if (!isAvailable) {
    const isBrowser = bridgeState === "browser" || (typeof window !== "undefined" && !window.electron);
    const isUpdateRequired = bridgeState === "update-required";
    const bridgeChecks = [
      { label: "Desktop", value: isBrowser ? "Required" : "Detected", icon: Download },
      { label: "Bridge", value: isUpdateRequired ? "Update needed" : bridgeState, icon: Plug },
      { label: "Output", value: "Background stream", icon: Terminal },
    ];

    return (
      <div className="relative flex h-full items-center justify-center overflow-hidden rounded-[8px] border border-slate-200 bg-[linear-gradient(135deg,rgba(14,165,233,0.1),transparent_34%),linear-gradient(315deg,rgba(16,185,129,0.09),transparent_32%),rgba(248,250,252,0.88)] p-6 text-center shadow-sm shadow-slate-950/[0.03] dark:border-slate-800 dark:bg-slate-950/40 sm:p-10">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/55 to-transparent" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.045)_1px,transparent_1px)] bg-[size:58px_58px] opacity-70 dark:bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)]" />
        <div className="relative w-full max-w-2xl space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[8px] border border-blue-200/70 bg-blue-100 text-blue-700 shadow-sm shadow-slate-950/[0.04] dark:border-blue-900/50 dark:bg-blue-950/60 dark:text-blue-200">
            <Bot className="h-8 w-8" aria-hidden />
          </div>
          <div className="space-y-2">
            <div className="mx-auto inline-flex items-center gap-2 rounded-[8px] border border-slate-200/80 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm shadow-slate-950/[0.03] dark:border-slate-800 dark:bg-slate-950/75 dark:text-slate-300">
              <Plug className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-300" aria-hidden />
              Automation bridge
            </div>
            <h3 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
              {isBrowser ? "Desktop App Required" : isUpdateRequired ? "Desktop App Update Required" : "Connecting to Automation..."}
            </h3>
            <p className="mx-auto max-w-lg text-sm leading-6 text-slate-600 dark:text-slate-400">
              {isBrowser
                ? "Rearvy Desktop is required so automation can run in the background on your machine."
                : isUpdateRequired
                  ? "This build is missing the automation bridge. Update the desktop app, then reopen it."
                  : "We are trying to reach the background automation bridge."}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {bridgeChecks.map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-[8px] border border-slate-200/80 bg-white/76 p-3 text-left shadow-sm shadow-slate-950/[0.03] dark:border-slate-800 dark:bg-slate-950/62">
                <Icon className="h-4 w-4 text-cyan-600 dark:text-cyan-300" aria-hidden />
                <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
                <p className="mt-1 truncate text-sm font-semibold capitalize text-slate-950 dark:text-slate-100">{value}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            {isBrowser || isUpdateRequired ? (
              <Button className="h-11 rounded-[8px] bg-blue-600 px-5 text-white hover:bg-blue-700" onClick={() => window.open("https://www.rearvy.com/download", "_blank", "noopener,noreferrer")}>
                <Download className="h-4 w-4" />
                Download Desktop App
              </Button>
            ) : (
              <Button variant="outline" className="h-11 rounded-[8px] px-5" onClick={handleRetryBridge}>
                <RefreshCw className="h-4 w-4" />
                Retry Connection
              </Button>
            )}
            {!isBrowser ? (
              <Button variant="outline" className="h-11 rounded-[8px] px-5" onClick={handleRetryBridge}>
                <RefreshCw className="h-4 w-4" />
                Recheck Bridge
              </Button>
            ) : null}
          </div>

          {isDesktop ? (
            <div className="rounded-[8px] border border-slate-800 bg-black/60 p-3 text-left font-mono text-[11px] text-slate-300">
              {(bridgeLog.length > 0 ? bridgeLog : ["Initializing bridge..."]).map((line, index) => (
                <div key={index}>{line}</div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm shadow-slate-950/[0.03] dark:border-slate-800 dark:bg-slate-950">
      <AWHeader
        status={status}
        workingDirectory={workingDirectory}
        desktopScope={desktopScope}
        onPause={handlePause}
        onResume={handleResume}
        onStop={handleStop}
        onOpenShell={handleOpenExternal}
        onUseCurrentFolder={useCurrentWorkingDirectory}
        onUseFullAccess={useFullDesktopAccess}
        onClearScope={() => updateScope({ mode: "folder", path: "" })}
        onScopePathChange={(path) => updateScope({ ...desktopScope, path, mode: "folder" })}
        onPickFolder={chooseScopeFolder}
      />

      <div className="grid min-h-0 flex-1 gap-4 p-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="grid min-h-0 gap-4 lg:grid-rows-[auto_1fr]">
          <AWEditor
            planDraft={planDraft}
            setPlanDraft={setPlanDraft}
            commandDraft={commandDraft}
            setCommandDraft={setCommandDraft}
            onApplyEdit={handleApplyEdit}
            onStartPlan={handleStartPlan}
            activeTask={activeTask}
            workingDirectory={workingDirectory}
            desktopScope={desktopScope}
            onScopePathChange={(path) => updateScope({ ...desktopScope, path, mode: "folder" })}
            onUseFullAccess={useFullDesktopAccess}
            onPickFolder={chooseScopeFolder}
          />

          <AWCurrentWork timeline={timeline} formatTime={formatTime} eventsEndRef={eventsEndRef} />
        </div>

        <aside className="grid min-h-0 gap-4 lg:grid-rows-[auto_1fr]">
          <AWHistory
            tasks={tasks}
            activeTask={activeTask}
            onSelectTask={(task) => {
              setPlanDraft(task.title);
              setCommandDraft(task.command);
              setActiveTask(task);
            }}
          />

          <AWLiveOutput commandOutput={commandOutput} onClear={() => setCommandOutput([])} />
        </aside>
      </div>
    </div>
  );
}
