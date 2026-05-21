"use client";

import React from "react";
import { Play, Square, AlertCircle, ExternalLink, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AWHeader({
  status,
  workingDirectory,
  onPause,
  onResume,
  onStop,
  onOpenShell,
}: {
  status: string;
  workingDirectory: string | null;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onOpenShell: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-100 to-blue-50 text-blue-600 dark:from-sky-900 dark:to-indigo-900 dark:text-blue-300">
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
          <Button variant="outline" className="h-9 rounded-lg" onClick={onPause}>
            <Square className="mr-2 h-4 w-4" />Pause
          </Button>
        ) : (
          <Button variant="outline" className="h-9 rounded-lg" onClick={onResume}>
            <Play className="mr-2 h-4 w-4" />Resume
          </Button>
        )}
        <Button variant="outline" className="h-9 rounded-lg" onClick={onStop}>
          <AlertCircle className="mr-2 h-4 w-4" />Stop
        </Button>
        <Button variant="outline" className="h-9 rounded-lg" onClick={onOpenShell}>
          <ExternalLink className="mr-2 h-4 w-4" />Open Shell
        </Button>
      </div>
    </div>
  );
}
