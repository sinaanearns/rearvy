"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Bot, Clock3, ExternalLink, Play, Plus, RotateCcw, Square, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

const HISTORY_KEY = "rearvy.automation.workspace.history.v1";

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
  const [bridgeLog, setBridgeLog] = useState<string[]>([]);
  const eventsEndRef = useRef<HTMLDivElement>(null);

  const electron = typeof window !== "undefined" ? (window as any).electron : undefined;
  const automation = electron?.automation;
  const terminal = electron?.terminal;

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

  const checkElectron = async () => {
    const hasWindow = typeof window !== "undefined";
    const hasElectron = hasWindow && !!(window as any).electron;
    const hasTerminal = hasElectron && !!(window as any).electron?.terminal;
    const hasAutomation = hasElectron && !!(window as any).electron?.automation;

    setBridgeLog((previous) => [
      ...previous.slice(-4),
      `[${new Date().toLocaleTimeString()}] bridge T:${String(hasTerminal)} A:${String(hasAutomation)}`,
    ]);

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
          setBridgeLog((previous) => [...previous.slice(-4), `automation state check failed: ${error instanceof Error ? error.message : String(error)}`]);
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
  }, []);

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
          setBridgeLog((previous) => [...previous.slice(-4), `[${new Date().toLocaleTimeString()}] bridge check failed: ${error instanceof Error ? error.message : String(error)}`]);
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

          <div className="rounded-xl border border-slate-200 bg-slate-100/80 p-3 text-left font-mono text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            {(bridgeLog.length > 0 ? bridgeLog : ["Initializing bridge..."]).map((line, index) => (
              <div key={index}>{line}</div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              Automation Workspace
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-300">
                {status}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {workingDirectory ? `Working in ${workingDirectory}` : "Background work runs through Rearvy Desktop."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status === "running" ? (
            <Button variant="outline" className="h-9 rounded-lg" onClick={handlePause}><Square className="mr-2 h-4 w-4" />Pause</Button>
          ) : (
            <Button variant="outline" className="h-9 rounded-lg" onClick={handleResume}><Play className="mr-2 h-4 w-4" />Resume</Button>
          )}
          <Button variant="outline" className="h-9 rounded-lg" onClick={handleStop}><AlertCircle className="mr-2 h-4 w-4" />Stop</Button>
          <Button variant="outline" className="h-9 rounded-lg" onClick={handleOpenExternal}><ExternalLink className="mr-2 h-4 w-4" />Open Shell</Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 p-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="grid min-h-0 gap-4 lg:grid-rows-[auto_1fr]">
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Edit the work</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Change the next instruction before it runs, or revise the current plan while paused.</p>
              </div>
              <div className="rounded-full bg-slate-200 px-2 py-1 text-[10px] uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {activeTask ? "Active task" : "No active task"}
              </div>
            </div>

            <form className="space-y-3" onSubmit={handleStartPlan}>
              <textarea
                value={planDraft}
                onChange={(event) => setPlanDraft(event.target.value)}
                className="min-h-24 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                placeholder="Describe the automation work you want Rearvy to do..."
              />
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <Input
                  value={commandDraft}
                  onChange={(event) => setCommandDraft(event.target.value)}
                  placeholder={workingDirectory ? `Run in ${workingDirectory}` : "Background action to execute"}
                  className="h-11 rounded-xl border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
                />
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={handleApplyEdit}><Plus className="mr-2 h-4 w-4" />Apply Edit</Button>
                  <Button type="submit" className="h-11 rounded-xl bg-blue-600 text-white hover:bg-blue-700"><Play className="mr-2 h-4 w-4" />Start</Button>
                </div>
              </div>
            </form>
          </section>

          <section className="min-h-0 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Current work</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Live progress from the automation bridge and background output.</p>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                <Clock3 className="mr-1 inline h-3.5 w-3.5" /> {timeline.length} events
              </div>
            </div>

            <div className="max-h-[32rem] overflow-auto p-4">
              <div className="space-y-3">
                {timeline.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
                    No automation events yet. Start a plan to see live work here.
                  </div>
                ) : timeline.map((event) => (
                  <article key={event.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{event.title}</div>
                      <span className="text-[10px] uppercase tracking-wider text-slate-400">{formatTime(event.timestamp)}</span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{event.detail}</p>
                  </article>
                ))}
                <div ref={eventsEndRef} />
              </div>
            </div>
          </section>
        </div>

        <aside className="grid min-h-0 gap-4 lg:grid-rows-[auto_1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Work history</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Recent background tasks saved on this device.</p>
            </div>
            <div className="max-h-80 space-y-3 overflow-auto p-4">
              {tasks.length === 0 ? (
                <div className="text-sm text-slate-500 dark:text-slate-400">No saved history yet.</div>
              ) : tasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${activeTask?.id === task.id ? "border-blue-500 bg-blue-500/5" : "border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:bg-slate-900"}`}
                  onClick={() => {
                    setPlanDraft(task.title);
                    setCommandDraft(task.command);
                    setActiveTask(task);
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{task.title}</div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-400">{task.status}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{task.command}</div>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-950 p-4 text-slate-100 dark:border-slate-800">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Live output</h2>
              <Button variant="ghost" className="h-8 px-2 text-xs text-slate-300 hover:bg-slate-900 hover:text-white" onClick={() => setCommandOutput([])}>Clear</Button>
            </div>
            <div className="max-h-64 overflow-auto rounded-xl bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-emerald-300">
              {commandOutput.length === 0 ? (
                <div className="text-slate-500">Awaiting background output...</div>
              ) : commandOutput.map((line, index) => <div key={`${index}-${line}`}>{line}</div>)}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
