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
  const [command, setCommand] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeProcessId, setActiveProcessId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "starting" | "running" | "stopped" | "error">("idle");
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if electron terminal API is available with retry logic
    let retryCount = 0;
    let retryTimeout: NodeJS.Timeout | null = null;

    const checkElectron = () => {
      const hasElectron = typeof window !== "undefined" && (window as any).electron;
      const hasTerminal = hasElectron && (window as any).electron.terminal;
      
      console.log(`[Terminal] Check attempt ${retryCount + 1}: hasElectron=${!!hasElectron}, hasTerminal=${!!hasTerminal}`);
      
      if (hasTerminal) {
        console.log("[Terminal] Terminal API detected - setting available");
        setIsAvailable(true);

        const terminal = (window as any).electron.terminal;
        
        const cleanupOutput = terminal.onOutput((output: { id: string, type: "stdout" | "stderr" | "error", data: string }) => {
          if (output.id === activeProcessId || activeProcessId === null) {
             setLogs(prev => [...prev, {
               id: Math.random().toString(36).substr(2, 9),
               type: output.type,
               data: output.data,
               timestamp: Date.now()
             }]);
          }
        });

        const cleanupStatus = terminal.onStatusChange((statusData: { id: string, status: "starting" | "running" | "stopped" | "error", code?: number }) => {
           if (statusData.id === activeProcessId || activeProcessId === null) {
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

        if (retryTimeout) clearTimeout(retryTimeout);
        return () => {
          cleanupOutput();
          cleanupStatus();
        };
      } else if (retryCount < 50) {
        // Retry with exponential backoff (max 50 retries = ~5 seconds)
        retryCount++;
        retryTimeout = setTimeout(checkElectron, Math.min(100 * Math.pow(1.05, retryCount), 200));
      } else {
        console.warn("[Terminal] Terminal API not available after 50 retries");
      }
    };

    checkElectron();

    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [activeProcessId]);

  useEffect(() => {
    // Auto-scroll to bottom
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

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
      const response = await (window as any).electron.terminal.runCommand({ command });
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
      setLogs(prev => [...prev, {
        id: Math.random().toString(36).substr(2, 9),
        type: "system",
        data: "Process terminated by user",
        timestamp: Date.now()
      }]);
    } catch (err) {
       console.error("Failed to stop process", err);
    }
  };

  const handleOpenExternal = async () => {
    if (isAvailable) {
       await (window as any).electron.terminal.openExternal();
    }
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  if (!isAvailable) {
    return (
      <div className="flex flex-col items-center justify-center p-8 h-full bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
        <TerminalIcon className="w-12 h-12 text-slate-400 mb-4" />
        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">Terminal Not Available</h3>
        <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-md">
          The terminal feature requires the Rearvy Desktop App. It is not available in the web-only mode.
        </p>
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
            placeholder="npm run dev, git status, python script.py..."
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
