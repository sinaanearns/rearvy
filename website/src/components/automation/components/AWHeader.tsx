"use client";


import { FolderOpen, LockKeyhole, Play, Square, AlertCircle, ExternalLink, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AWHeader({
  status,
  workingDirectory,
  desktopScope,
  onPause,
  onResume,
  onStop,
  onOpenShell,
  onUseCurrentFolder,
  onUseFullAccess,
  onClearScope,
  onScopePathChange,
  onPickFolder,
}: {
  status: string;
  workingDirectory: string | null;
  desktopScope: { mode: "folder" | "full-access" | "bypass"; path: string };
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onOpenShell: () => void;
  onUseCurrentFolder: () => void;
  onUseFullAccess: () => void;
  onClearScope: () => void;
  onScopePathChange: (path: string) => void;
  onPickFolder: () => void;
}) {
  const isFullAccess = desktopScope.mode === "full-access" || desktopScope.mode === "bypass";
  const scopeLabel = isFullAccess
    ? desktopScope.mode === "bypass"
      ? "Bypass desktop access"
      : "Full desktop access"
    : desktopScope.path || workingDirectory || "No folder selected";

  return (
    <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-blue-500/10 text-blue-600 dark:text-blue-300">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              Automation Workspace
              <span className="rounded-[8px] border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium capitalize text-emerald-600 dark:text-emerald-300">
                {status}
              </span>
              <span className={`rounded-[8px] px-2 py-0.5 text-xs font-medium ${isFullAccess ? "border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300" : "border border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300"}`}>
                {isFullAccess ? (desktopScope.mode === "bypass" ? "bypass" : "full access") : "scoped"}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isFullAccess ? (desktopScope.mode === "bypass" ? "AI can operate across the desktop but will require approvals for high-risk actions." : "AI can operate across the desktop.") : scopeLabel === "No folder selected" ? "Select a folder to limit file edits to Rearvy-approved scope." : `Working in ${scopeLabel}`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {status === "running" ? (
            <Button variant="outline" className="h-9 rounded-[8px]" onClick={onPause}>
              <Square className="mr-2 h-4 w-4" />Pause
            </Button>
          ) : (
            <Button variant="outline" className="h-9 rounded-[8px]" onClick={onResume}>
              <Play className="mr-2 h-4 w-4" />Resume
            </Button>
          )}
          <Button variant="outline" className="h-9 rounded-[8px]" onClick={onStop}>
            <AlertCircle className="mr-2 h-4 w-4" />Stop
          </Button>
          <Button variant="outline" className="h-9 rounded-[8px]" onClick={onOpenShell}>
            <ExternalLink className="mr-2 h-4 w-4" />Open Shell
          </Button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 rounded-[8px] border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60 xl:grid-cols-[1fr_auto] xl:items-center">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <LockKeyhole className="h-3.5 w-3.5" />Desktop scope
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            The AI should only edit files inside the selected folder unless you intentionally enable full access.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={desktopScope.path}
            onChange={(event) => onScopePathChange(event.target.value)}
            placeholder={workingDirectory ?? "Choose a folder or paste a path"}
            className="h-10 min-w-[280px] rounded-[8px] border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-10 rounded-[8px]" onClick={onPickFolder}>
              <Search className="mr-2 h-4 w-4" />Browse
            </Button>
            <Button variant="outline" className="h-10 rounded-[8px]" onClick={onUseCurrentFolder}>
              <FolderOpen className="mr-2 h-4 w-4" />Use current folder
            </Button>
            <Button variant="outline" className="h-10 rounded-[8px]" onClick={onClearScope}>
              Clear
            </Button>
            <Button className="h-10 rounded-[8px] bg-amber-600 text-white hover:bg-amber-700" onClick={onUseFullAccess}>
              Full access
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
