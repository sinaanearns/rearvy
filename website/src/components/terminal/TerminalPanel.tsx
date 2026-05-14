"use client";

import React, { useState, useEffect, useRef } from "react";
import { Terminal as TerminalIcon, Play, Square, ExternalLink, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface LogEntry {
  id: string;
  type: "stdout" | "stderr" | "error" | "system";
  data: string;
  timestamp: number;
}

export function TerminalPanel() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [bridgeState, setBridgeState] = useState<"checking" | "browser" | "update-required" | "connecting" | "ready">("checking");
  const [command, setCommand] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeProcessId, setActiveProcessId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "starting" | "running" | "stopped" | "error">("idle");
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [checkLogs, setCheckLogs] = useState<string[]>([]);
  const [capabilities, setCapabilities] = useState<DesktopCapabilities | null>(null);
  const [workingDirectory, setWorkingDirectory] = useState<string | null>(null);

  const checkElectron = async () => {
    const hasWindow = typeof window !== "undefined";
    const hasElectron = hasWindow && (window as any).electron;
    const hasTerminal = hasElectron && (window as any).electron.terminal;

    const electron = (window as any).electron;
    const electronKeys = hasElectron ? Object.keys(electron).join(',') : 'none';
    const hasClicky = !!(electron && electron.clicky);
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
    const log = `[${new Date().toLocaleTimeString()}] Keys: ${electronKeys} (T:${!!hasTerminal}, C:${hasClicky}, A:${hasAuto}, API:${localApiPort}, B:${bridgeVersion})`;
    setCheckLogs(prev => [...prev.slice(-4), log]);

    if (!hasElectron) {
      setIsAvailable(false);
      setBridgeState("browser");
      return null;
    }

    if (hasTerminal) {
      setIsAvailable(true);
      setBridgeState("ready");
      const terminal = (window as any).electron.terminal;
      
      const cleanupOutput = terminal.onOutput((output: { id: string, type: "stdout" | "stderr" | "error", data: string }) => {
        setLogs(prev => [...prev, {
          id: Math.random().toString(36).substr(2, 9),
          type: output.type,
          data: output.data,
          timestamp: Date.now()
        }]);
      });

      const cleanupStatus = terminal.onStatusChange((statusData: { id: string, status: "starting" | "running" | "stopped" | "error", code?: number }) => {
           if (statusData.id === activeProcessId || !activeProcessId) {
             if (statusData.status === "stopped" || statusData.status === "error") {
               setStatus(statusData.status);
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
      setWorkingDirectory(payload.cwd);
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
      const response = await (window as any).electron.terminal.runCommand({
        command,
        cwd: workingDirectory ?? undefined
      });
      if (response.success) {
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
    } catch (err: any) {
      setStatus("error");
      setLogs(prev => [...prev, {
        id: Math.random().toString(36).substr(2, 9),
        type: "error",
        data: `Execution error: ${err.message}`,
        timestamp: Date.now()
      }]);
    }
  };

  const handleStopCommand = async () => {
    if (!activeProcessId || !isAvailable) return;
    try {
      await (window as any).electron.terminal.stopProcess(activeProcessId);
      setStatus("stopped");
      setActiveProcessId(null);
    } catch (err) {
       console.error("Failed to stop process", err);
    }
  };

  const handleOpenExternal = async () => {
    if (isAvailable) {
       await (window as any).electron.terminal.openExternal(workingDirectory ?? undefined);
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
    const isBrowser = bridgeState === "browser" || (typeof window !== "undefined" && !(window as any).electron);
    const isUpdateRequired = bridgeState === "update-required";

    return (
      <div className="flex flex-col items-center justify-center p-12 h-full bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-center animate-in fade-in duration-500">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full"></div>
          <TerminalIcon className="w-16 h-16 text-blue-600 dark:text-blue-500 relative z-10" />
        </div>
        
        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
          {isBrowser ? "Desktop App Required" : isUpdateRequired ? "Desktop App Update Required" : "Connecting to Terminal..."}
        </h3>
        
        <p className="text-slate-600 dark:text-slate-400 mt-2 max-w-md leading-relaxed mb-8">
          {isBrowser
            ? "The Local Execution Engine requires the Rearvy Desktop App to securely run commands on your machine."
            : isUpdateRequired
              ? "This desktop shell is running an older bridge without terminal access. Install the latest Rearvy desktop app, then reopen it."
              : "We're having trouble reaching the desktop backend. Please ensure the app is running correctly."}
        </p>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          {isBrowser || isUpdateRequired ? (
            <Button 
              className="bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02]"
              onClick={() => window.open('https://www.rearvy.com/download', '_blank')}
            >
              {isUpdateRequired ? "Download Latest App" : "Download Desktop App"}
            </Button>
          ) : (
            <Button 
              variant="outline"
              className="py-6 text-lg font-semibold rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              onClick={handleRetryBridge}
            >
              Retry Connection
            </Button>
          )}
          {!isBrowser && (
            <Button
              variant="outline"
              className="py-5 text-base font-semibold rounded-xl border-slate-200 dark:border-slate-700"
              onClick={handleRetryBridge}
            >
              Recheck Bridge
            </Button>
          )}
          
          <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-800 w-full text-left">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-2">Diagnostics</p>
            <div className="bg-slate-100 dark:bg-slate-950 p-3 rounded-lg font-mono text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
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
    <div className="flex flex-col h-full bg-[#1E1E1E] rounded-lg border border-slate-800 overflow-hidden shadow-xl font-mono text-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#2D2D2D] border-b border-slate-700">
        <div className="flex items-center gap-2 text-slate-200">
          <TerminalIcon className="w-4 h-4" />
          <span className="font-semibold text-xs tracking-wider uppercase">Local Execution Engine</span>
          {workingDirectory ? (
            <span className="max-w-[28rem] truncate text-[11px] text-slate-400" title={workingDirectory}>
              {workingDirectory}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {status === "running" ? (
             <div className="flex items-center gap-1.5 text-amber-400 text-xs font-medium">
               <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
               Running
             </div>
          ) : status === "error" ? (
             <div className="flex items-center gap-1.5 text-red-400 text-xs font-medium">
               <AlertCircle className="w-3.5 h-3.5" /> Error
             </div>
          ) : status === "stopped" ? (
             <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium">
               <CheckCircle2 className="w-3.5 h-3.5" /> Stopped
             </div>
          ) : (
            <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium">
               <Clock className="w-3.5 h-3.5" /> Idle
             </div>
          )}
          
          <div className="w-px h-4 bg-slate-600 mx-1"></div>
          
          <button 
            onClick={handleClearLogs}
            className="text-slate-400 hover:text-white transition-colors text-xs"
          >
            Clear
          </button>
          <button 
            onClick={handleOpenExternal}
            className="text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-xs"
            title="Open native PowerShell window"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Native
          </button>
        </div>
      </div>

      {/* Logs Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1 bg-[#1E1E1E]">
        {logs.length === 0 ? (
          <div className="text-slate-500 italic mt-2">Ready to execute commands (npm, git, python, etc)...</div>
        ) : (
          logs.map((log) => (
            <div 
              key={log.id} 
              className={`whitespace-pre-wrap break-words leading-relaxed ${
                log.type === 'stderr' || log.type === 'error' ? 'text-red-400' :
                log.type === 'system' ? 'text-blue-400 font-medium' :
                'text-slate-300'
              }`}
            >
              {log.data}
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-[#252526] border-t border-slate-800 flex gap-2">
        <form onSubmit={handleRunCommand} className="flex-1 flex gap-2">
          <Input 
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder={workingDirectory ? `Run in ${workingDirectory}` : "npm run dev, git status, python script.py..."}
            className="bg-[#1E1E1E] border-slate-700 text-slate-200 font-mono h-10 focus-visible:ring-1 focus-visible:ring-blue-500 placeholder:text-slate-600"
            disabled={status === "running"}
          />
          {status === "running" ? (
             <Button 
               type="button"
               variant="destructive"
               onClick={handleStopCommand}
               className="h-10 w-24 gap-2 font-mono font-medium"
             >
               <Square className="w-4 h-4 fill-current" /> Stop
             </Button>
          ) : (
             <Button 
               type="submit" 
               className="h-10 w-24 gap-2 bg-blue-600 hover:bg-blue-700 text-white font-mono font-medium"
               disabled={!command.trim()}
             >
               <Play className="w-4 h-4 fill-current" /> Run
             </Button>
          )}
        </form>
      </div>
    </div>
  );
}
