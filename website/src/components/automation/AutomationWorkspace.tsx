"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Bot, Clock3, ExternalLink, Play, Square, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AWHeader } from "@/components/automation/components/AWHeader";
import { AWEditor } from "@/components/automation/components/AWEditor";
import { AWCurrentWork } from "@/components/automation/components/AWCurrentWork";
import { AWHistory } from "@/components/automation/components/AWHistory";
import { AWLiveOutput } from "@/components/automation/components/AWLiveOutput";

type AutomationStatus = "idle" | "planning" | "running" | "paused" | "stopped" | "error";
type EventType = "system" | "plan" | "command" | "result" | "edit" | "error";

type AutomationEvent = {
  id: string;
  type: EventType;
  title: string;
  detail: string;
  timestamp: number;
};

type AutomationTask = {
  id: string;
  title: string;
  command: string;
  status: AutomationStatus;
  createdAt: number;
  updatedAt: number;
};

type DesktopScopeMode = "folder" | "full-access" | "bypass";

type DesktopScope = {
  mode: DesktopScopeMode;
  path: string;
};

const HISTORY_KEY = "rearvy.automation.workspace.history.v1";
const SCOPE_KEY = "rearvy.automation.workspace.scope.v1";

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function safeReadHistory() {
  if (typeof window === "undefined") {
    return [] as AutomationTask[];
  }

  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) {
      return [] as AutomationTask[];
    }

    const parsed = JSON.parse(raw) as AutomationTask[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as AutomationTask[];
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

  const electron = typeof window !== "undefined" ? (window as any).electron : undefined;
  const automation = electron?.automation;
  const terminal = electron?.terminal;
  const workspace = electron?.workspace;
  const isDesktop = typeof window !== "undefined" && !!(window as any).electron;

  const timeline = useMemo(() => {
    return [...events].sort((left, right) => right.timestamp - left.timestamp);
  }, [events]);

  function pushEvent(type: EventType, title: string, detail: string) {
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
    const hasElectron = hasWindow && !!(window as any).electron;
    const hasTerminal = hasElectron && !!(window as any).electron?.terminal;
    const hasAutomation = hasElectron && !!(window as any).electron?.automation;

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

      if (hasAutomation && automation?.getState) {
        try {
          const state = await automation.getState();
          if (state?.workflowId) {
            pushEvent("system", "Current work detected", `Workflow ${state.workflowId} is ${state.state ?? "unknown"}.`);
            setStatus(state.state === "running" ? "running" : state.state === "paused" ? "paused" : "idle");
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
            .map((h: any) => ({
              id: h.workflowId || h.id || makeId(),
              title: h.name || h.task || `Workflow ${h.workflowId ?? h.id ?? ""}`,
              command: (h.steps && h.steps[0] && (h.steps[0].action?.command ?? h.steps[0].command)) || "",
              status: (h.state as AutomationStatus) || "stopped",
              createdAt: h.startedAt ? Date.parse(h.startedAt) : Date.now(),
              updatedAt: h.updatedAt ? Date.parse(h.updatedAt) : Date.now(),
            } as AutomationTask));

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

    const unsubState = automation.onStateChange?.((state: any) => {
      pushEvent("system", "State change", `Workflow ${state.workflowId} is ${state.state}`);
      setStatus(state.state === "running" ? "running" : state.state === "paused" ? "paused" : "idle");

      const task: AutomationTask = {
        id: state.workflowId || makeId(),
        title: state.task || state.workflowId || "Workflow",
        command: (state.nextStepName && state.nextStepName) || "",
        status: (state.state as AutomationStatus) || "idle",
        createdAt: state.startedAt ? Date.parse(state.startedAt) : Date.now(),
        updatedAt: Date.now(),
      };

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

    const cleanupStatus = terminal.onStatusChange((nextStatus: { status?: AutomationStatus; code?: number }) => {
      if (!nextStatus.status) {
        return;
      }

      setStatus(nextStatus.status);
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
    const isBrowser = bridgeState === "browser" || (typeof window !== "undefined" && !(window as any).electron);
    const isUpdateRequired = bridgeState === "update-required";

    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-10 text-center dark:border-slate-800 dark:bg-slate-950/40">
        <div className="max-w-md space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Bot className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {isBrowser ? "Desktop App Required" : isUpdateRequired ? "Desktop App Update Required" : "Connecting to Automation..."}
            </h3>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {isBrowser
                ? "Rearvy Desktop is required so automation can run in the background on your machine."
                : isUpdateRequired
                  ? "This build is missing the automation bridge. Update the desktop app, then reopen it."
                  : "We are trying to reach the background automation bridge."}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {isBrowser || isUpdateRequired ? (
              <Button className="h-11 rounded-xl bg-blue-600 text-white hover:bg-blue-700" onClick={() => window.open("https://www.rearvy.com/download", "_blank")}>Download Desktop App</Button>
            ) : (
              <Button variant="outline" className="h-11 rounded-xl" onClick={handleRetryBridge}>Retry Connection</Button>
            )}
            {!isBrowser ? (
              <Button variant="outline" className="h-11 rounded-xl" onClick={handleRetryBridge}>Recheck Bridge</Button>
            ) : null}
          </div>

          {isDesktop ? (
            <div className="rounded-xl border border-slate-800 bg-black/60 p-3 text-left font-mono text-[11px] text-slate-300">
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
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
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
