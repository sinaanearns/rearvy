"use client";

import React, { useState, useEffect, useRef } from "react";
import { Terminal as TerminalIcon, Play, Square, ExternalLink, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClientLogger } from "@/lib/client-diagnostics";
import { cn } from "@/lib/utils";

const log = createClientLogger("TerminalPanel");

interface LogEntry {
  id: string;
  type: "stdout" | "stderr" | "error" | "system";
  data: string;
  timestamp: number;
}

type ElectronBridge = NonNullable<Window["electron"]>;
type TerminalBridge = NonNullable<ElectronBridge["terminal"]>;
type TerminalStatus = "idle" | "starting" | "running" | "stopped" | "error";
type LogType = LogEntry["type"];
type ElectronBridgeWithCapabilities = ElectronBridge & {
  getCapabilities?: () => Promise<DesktopCapabilities>;
};

const terminalStatusTone: Record<TerminalStatus, string> = {
  idle: "border-slate-700 bg-slate-900 text-slate-300",
  starting: "border-sky-500/30 bg-sky-500/10 text-sky-200",
  running: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  stopped: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  error: "border-red-500/30 bg-red-500/10 text-red-200",
};

function getLogClass(type: LogType) {
  if (type === "stderr" || type === "error") {
    return "border-red-500/20 bg-red-500/[0.04] text-red-300";
  }

  if (type === "system") {
    return "border-sky-500/20 bg-sky-500/[0.04] text-sky-300";
  }

  return "border-transparent text-slate-300";
}

function renderStatus(status: TerminalStatus) {
  if (status === "running") {
    return (
      <>
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-[8px] bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-[8px] bg-amber-500" />
        </span>
        Running
      </>
    );
  }

  if (status === "error") {
    return (
      <>
        <AlertCircle className="h-3.5 w-3.5" />
        Error
      </>
    );
  }

  if (status === "stopped") {
    return (
      <>
        <CheckCircle2 className="h-3.5 w-3.5" />
        Stopped
      </>
    );
  }

  if (status === "starting") {
    return (
      <>
        <Clock className="h-3.5 w-3.5" />
        Starting
      </>
    );
  }

  return (
    <>
      <Clock className="h-3.5 w-3.5" />
      Idle
    </>
  );
}

function getElectronBridge(): ElectronBridgeWithCapabilities | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.electron as ElectronBridgeWithCapabilities | undefined;
}

function getTerminalBridge(): TerminalBridge | undefined {
  return getElectronBridge()?.terminal;
}

function normalizeTerminalStatus(value: string): TerminalStatus {
  if (value === "starting" || value === "running" || value === "stopped" || value === "error") {
    return value;
  }

  return "error";
}

function normalizeLogType(value: string): LogType {
  return value === "stdout" || value === "stderr" || value === "error" ? value : "system";
}

export function TerminalPanel() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [bridgeState, setBridgeState] = useState<"checking" | "browser" | "update-required" | "connecting" | "ready">("checking");
  const [command, setCommand] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeProcessId, setActiveProcessId] = useState<string | null>(null);
  const [status, setStatus] = useState<TerminalStatus>("idle");
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [checkLogs, setCheckLogs] = useState<string[]>([]);
  const [capabilities, setCapabilities] = useState<DesktopCapabilities | null>(null);
  const [workingDirectory, setWorkingDirectory] = useState<string | null>(null);

  const checkElectron = async () => {
    const hasWindow = typeof window !== "undefined";
    const electron = hasWindow ? getElectronBridge() : undefined;
    const terminal = electron?.terminal;
    const hasElectron = Boolean(electron);
    const hasTerminal = Boolean(terminal);

    const electronKeys = electron ? Object.keys(electron).join(',') : 'none';
    const hasMaria = !!(electron && electron.maria);
    const hasAuto = !!(electron && electron.automation);

    let nextCapabilities: DesktopCapabilities | null = null;
    if (electron?.getCapabilities) {
      try {
        nextCapabilities = await electron.getCapabilities();
        setCapabilities(nextCapabilities);
      } catch (error) {
        nextCapabilities = {
          error: error instanceof Error ? error.message : String(error),
        };
        setCapabilities(nextCapabilities);
      }
    } else {
      setCapabilities(null);
    }

    const bridgeVersion = nextCapabilities?.bridgeVersion || "missing";
    const localApiPort = nextCapabilities?.localApi?.port ?? "n/a";
    const log = `[${new Date().toLocaleTimeString()}] Keys: ${electronKeys} (T:${!!hasTerminal}, C:${hasMaria}, A:${hasAuto}, API:${localApiPort}, B:${bridgeVersion})`;
    setCheckLogs(prev => [...prev.slice(-4), log]);

    if (!hasElectron) {
      setIsAvailable(false);
      setBridgeState("browser");
      return null;
    }

    if (terminal) {
      setIsAvailable(true);
      setBridgeState("ready");
      
      const cleanupOutput = terminal.onOutput((output: { id: string; type: string; data: string }) => {
        setLogs(prev => [...prev, {
          id: Math.random().toString(36).substr(2, 9),
          type: normalizeLogType(output.type),
          data: output.data,
          timestamp: Date.now()
        }]);
      });

      const cleanupStatus = terminal.onStatusChange((statusData: { id: string; status: string; code?: number }) => {
           if (statusData.id === activeProcessId || !activeProcessId) {
             const nextStatus = normalizeTerminalStatus(statusData.status);
             if (nextStatus === "stopped" || nextStatus === "error") {
               setStatus(nextStatus);
               setActiveProcessId(null);
               setLogs(prev => [...prev, {
                 id: Math.random().toString(36).substr(2, 9),
                 type: "system",
                 data: `Process exited with code ${statusData.code ?? 'unknown'}`,
                 timestamp: Date.now()
               }]);
             } else {
               setStatus("running");
             }
           }
      });

      return () => {
        cleanupOutput();
        cleanupStatus();
      };
    }

    setIsAvailable(false);
    setBridgeState("update-required");
    return null;
  };

  useEffect(() => {
    let retryTimeout: NodeJS.Timeout | null = null;
    let retryInterval: NodeJS.Timeout | null = null;
    let cleanup: (() => void) | null = null;
    let connected = false;
    let checking = false;

    const attempt = () => {
      if (connected || checking) {
        return;
      }

      checking = true;
      void checkElectron()
        .then((result) => {
          checking = false;
          if (result) {
            connected = true;
            cleanup = result;
            if (retryTimeout) {
              clearTimeout(retryTimeout);
              retryTimeout = null;
            }
            if (retryInterval) {
              clearInterval(retryInterval);
              retryInterval = null;
            }
          }
        })
        .catch((error) => {
          checking = false;
          setBridgeState("connecting");
          setCheckLogs(prev => [...prev.slice(-4), `[${new Date().toLocaleTimeString()}] Bridge check failed: ${error instanceof Error ? error.message : String(error)}`]);
        });
    };

    attempt();
    retryInterval = setInterval(attempt, 500);

    const handleBridgeReady = () => {
      attempt();
    };

    const handleWindowFocus = () => {
      attempt();
    };

    window.addEventListener("rearvy-electron-ready", handleBridgeReady as EventListener);
    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleBridgeReady);

    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
      if (retryInterval) clearInterval(retryInterval);
      if (cleanup) cleanup();
      window.removeEventListener("rearvy-electron-ready", handleBridgeReady as EventListener);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleBridgeReady);
    };
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const unsubscribe = window.electron?.onOpenPath?.((payload) => {
      setWorkingDirectory(payload.cwd ?? null);
      setLogs(prev => [...prev, {
        id: Math.random().toString(36).substr(2, 9),
        type: "system",
        data: `Opened ${payload.kind}: ${payload.path}\nWorking directory: ${payload.cwd}`,
        timestamp: Date.now()
      }]);
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const handleRunCommand = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!command.trim() || !isAvailable) return;
    
    setLogs(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      type: "system",
      data: `> ${command}`,
      timestamp: Date.now()
    }]);

    setStatus("starting");
    try {
      const terminal = getTerminalBridge();
      if (!terminal) {
        throw new Error("Terminal bridge is not available");
      }

      const response = await terminal.runCommand({
        command,
        cwd: workingDirectory ?? undefined
      });
      if (response.success) {
        if (!response.processId) {
          throw new Error("Terminal command started without a process id");
        }

        setActiveProcessId(response.processId);
        setCommand("");
      } else {
        setStatus("error");
        setLogs(prev => [...prev, {
          id: Math.random().toString(36).substr(2, 9),
          type: "error",
          data: `Failed to start: ${response.error}`,
          timestamp: Date.now()
        }]);
      }
    } catch (err: unknown) {
      setStatus("error");
      setLogs(prev => [...prev, {
        id: Math.random().toString(36).substr(2, 9),
        type: "error",
        data: `Execution error: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now()
      }]);
    }
  };

  const handleStopCommand = async () => {
    if (!activeProcessId || !isAvailable) return;
    try {
      await getTerminalBridge()?.stopProcess(activeProcessId);
      setStatus("stopped");
      setActiveProcessId(null);
    } catch (err) {
       log.error("Failed to stop process", err);
    }
  };

  const handleOpenExternal = async () => {
    if (isAvailable) {
       await getTerminalBridge()?.openExternal(workingDirectory ?? undefined);
    }
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  const handleRetryBridge = () => {
    setBridgeState("checking");
    void checkElectron();
  };

  if (!isAvailable) {
    const isBrowser = bridgeState === "browser" || (typeof window !== "undefined" && !window.electron);
    const isUpdateRequired = bridgeState === "update-required";

    return (
      <div className="relative flex h-full min-h-[520px] flex-col justify-center overflow-hidden rounded-[8px] border border-border/70 bg-card/85 p-6 text-center shadow-sm shadow-slate-950/[0.04] animate-in fade-in duration-500 dark:bg-slate-950/70 sm:p-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(56,189,248,0.1),transparent_38%),linear-gradient(248deg,rgba(16,185,129,0.08),transparent_42%)]"
        />

        <div className="relative mx-auto flex max-w-2xl flex-col items-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-[8px] border border-sky-500/20 bg-sky-500/10 text-sky-600 shadow-sm dark:text-sky-300">
            <TerminalIcon className="h-8 w-8" />
          </div>

          <h3 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {isBrowser ? "Desktop App Required" : isUpdateRequired ? "Desktop App Update Required" : "Connecting to Terminal"}
          </h3>

          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            {isBrowser
              ? "The local execution engine runs inside the Rearvy desktop app so commands stay on your machine."
              : isUpdateRequired
                ? "This desktop shell is running an older bridge without terminal access. Install the latest Rearvy desktop app, then reopen it."
                : "Rearvy is checking the desktop bridge before enabling command execution."}
          </p>

          <div className="mt-7 flex w-full max-w-sm flex-col gap-3">
            {isBrowser || isUpdateRequired ? (
              <Button
                className="h-12 rounded-[8px] bg-slate-950 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                onClick={() => window.open("https://www.rearvy.com/download", "_blank", "noopener,noreferrer")}
              >
                {isUpdateRequired ? "Download Latest App" : "Download Desktop App"}
              </Button>
            ) : (
              <Button
                variant="outline"
                className="h-12 rounded-[8px] border-border/70 bg-background/70 text-sm font-semibold shadow-sm"
                onClick={handleRetryBridge}
              >
                Retry Connection
              </Button>
            )}
            {!isBrowser ? (
              <Button
                variant="outline"
                className="h-11 rounded-[8px] border-border/70 bg-background/70 text-sm font-semibold"
                onClick={handleRetryBridge}
              >
                Recheck Bridge
              </Button>
            ) : null}
          </div>

          <div className="mt-8 w-full max-w-xl rounded-[8px] border border-border/70 bg-background/80 p-3 text-left shadow-sm dark:bg-slate-950/80">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5" />
              Diagnostics
            </div>
            <div className="space-y-1 rounded-[8px] bg-slate-950 p-3 font-mono text-[11px] leading-5 text-slate-300">
              {capabilities ? (
                <div>
                  bridge={capabilities.bridgeVersion || "missing"} terminal={String(!!capabilities.terminal)} localApi={String(capabilities.localApi?.port ?? "n/a")}
                </div>
              ) : null}
              {checkLogs.length > 0 ? (
                checkLogs.map((log, i) => <div key={i}>{log}</div>)
              ) : (
                <div>Initializing bridge...</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[520px] flex-col overflow-hidden rounded-[8px] border border-slate-800/90 bg-slate-950 font-mono text-sm text-slate-100 shadow-sm shadow-slate-950/20">
      <div className="flex flex-col gap-3 border-b border-slate-800 bg-slate-900/90 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3 text-slate-200">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-sky-400/20 bg-sky-400/10 text-sky-200">
            <TerminalIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-xs font-medium text-slate-400">
              Local Execution Engine
            </div>
            <div className="mt-0.5 flex min-w-0 items-center gap-2 text-[11px] text-slate-500">
              <span>cwd</span>
              <span className="h-1 w-1 rounded-[8px] bg-slate-700" />
              <span className="truncate">
                {workingDirectory || "default workspace"}
              </span>
            </div>
          </div>
          {workingDirectory ? (
            <span className="sr-only" title={workingDirectory}>{workingDirectory}</span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className={cn("inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-2.5 text-xs font-medium", terminalStatusTone[status])}>
            {renderStatus(status)}
          </div>

          <button
            onClick={handleClearLogs}
            className="h-8 rounded-[8px] border border-slate-800 px-3 text-xs text-slate-400 transition-colors hover:border-slate-700 hover:bg-slate-900 hover:text-white"
          >
            Clear
          </button>
          <button
            onClick={handleOpenExternal}
            className="flex h-8 items-center gap-1.5 rounded-[8px] border border-slate-800 px-3 text-xs text-slate-400 transition-colors hover:border-slate-700 hover:bg-slate-900 hover:text-white"
            title="Open native PowerShell window"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Native
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto bg-slate-950 p-4">
        {logs.length === 0 ? (
          <div className="grid min-h-[240px] place-items-center rounded-[8px] border border-dashed border-slate-800 bg-slate-900/30 p-6 text-center">
            <div>
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-[8px] border border-slate-800 bg-slate-900 text-slate-400">
                <TerminalIcon className="h-4 w-4" />
              </div>
              <div className="text-sm font-medium text-slate-300">Ready for commands</div>
              <div className="mt-1 text-xs text-slate-500">
                {workingDirectory ? "Commands will run in the selected workspace." : "Commands will run in the default desktop context."}
              </div>
            </div>
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className={cn("rounded-[8px] border px-3 py-1.5 whitespace-pre-wrap break-words leading-relaxed", getLogClass(log.type))}
            >
              {log.data}
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>

      <div className="border-t border-slate-800 bg-slate-900/90 p-3">
        <form onSubmit={handleRunCommand} className="flex flex-col gap-2 sm:flex-row">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[8px] border border-slate-800 bg-slate-950 px-3">
            <span className="text-sky-300">$</span>
            <Input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder={workingDirectory ? `Run in ${workingDirectory}` : "npm run dev, git status, python script.py..."}
              className="h-10 border-0 bg-transparent px-0 font-mono text-slate-200 shadow-none focus-visible:ring-0 placeholder:text-slate-600"
            disabled={status === "running"}
          />
          </div>
          {status === "running" ? (
            <Button
              type="button"
              variant="destructive"
              onClick={handleStopCommand}
              className="h-10 gap-2 rounded-[8px] font-mono font-medium sm:w-24"
            >
              <Square className="h-4 w-4 fill-current" />
              Stop
            </Button>
          ) : (
            <Button
              type="submit"
              className="h-10 gap-2 rounded-[8px] bg-sky-500 font-mono font-medium text-slate-950 hover:bg-sky-400 sm:w-24"
              disabled={!command.trim()}
            >
              <Play className="h-4 w-4 fill-current" />
              Run
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
