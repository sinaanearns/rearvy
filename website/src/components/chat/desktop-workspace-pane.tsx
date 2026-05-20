"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

interface DesktopWorkspacePaneProps {
  sessionId: string;
  onClose: () => void;
  isOpen: boolean;
}

export function DesktopWorkspacePane({ sessionId, onClose, isOpen }: DesktopWorkspacePaneProps) {
  const [state, setState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<number | null>(null);

  const fetchState = async () => {
    try {
      // Prefer local IPC when available (Electron)
      if (typeof window !== "undefined" && (window as any).electron?.automation) {
        const s = await (window as any).electron.automation.getState();
        setState(s);
        setLoading(false);
        return;
      }

      // Fallback to API route if provided
      const res = await fetch(`/api/desktop/sessions/${sessionId}`);
      if (!res.ok) throw new Error("Failed to fetch desktop session");
      const data = await res.json();
      setState(data);
    } catch (err) {
      console.error("DesktopWorkspacePane fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchState();
    intervalRef.current = window.setInterval(fetchState, 2000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, sessionId]);

  if (!isOpen) return null;

  return (
    <div className={cn(
      "flex h-full w-full flex-col border-l border-border/70 bg-background/50 backdrop-blur-xl lg:w-[450px] xl:w-[550px]",
      "fixed inset-y-0 right-0 z-50 lg:relative lg:inset-auto"
    )}>
      <div className="flex items-center justify-between border-b border-border/70 p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500">
            <Monitor className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Desktop Workspace</h2>
            <p className="text-[11px] text-muted-foreground">Live desktop automation stream</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full hover:bg-muted">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading && <div className="text-sm text-muted-foreground">Loading...</div>}

        {!loading && !state && (
          <div className="text-sm text-muted-foreground">No active desktop session.</div>
        )}

        {state && (
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">Workflow: {state.task || state.workflowId}</div>
            <div className="text-xs">Status: <strong>{state.state}</strong></div>
            <div className="text-xs">Step: {state.currentStepName || state.currentStep || '—' } ({state.currentStepIndex}/{state.totalSteps})</div>

            {state.screenshotDataUrl && (
              <div className="border border-border/50 bg-black/5 p-1">
                <img src={state.screenshotDataUrl} alt="screenshot" className="w-full object-contain" />
              </div>
            )}

            <div className="font-mono text-xs max-h-40 overflow-auto border border-border/50 p-2 bg-background/60">
              {state.logs && state.logs.length > 0 ? (
                state.logs.map((l: any, i: number) => (
                  <div key={i} className="mb-1">[{i}] {l.stepName} — {l.status}</div>
                ))
              ) : (
                <div className="text-muted-foreground">No logs yet.</div>
              )}
            </div>

            <div className="flex gap-2">
              <Button onClick={async () => { if ((window as any).electron?.automation) { await (window as any).electron.automation.pause(); } }}>Pause</Button>
              <Button onClick={async () => { if ((window as any).electron?.automation) { await (window as any).electron.automation.resume(); } }}>Resume</Button>
              <Button variant="destructive" onClick={async () => { if ((window as any).electron?.automation) { await (window as any).electron.automation.stop(); } }}>Stop</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DesktopWorkspacePane;
