"use client";

import { OperationsConsole } from "@/components/operations/OperationsConsole";
import { Activity } from "lucide-react";

export default function TerminalPage() {
  return (
    <div className="mx-auto flex h-[calc(100vh-6rem)] w-full max-w-7xl flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-col gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          <Activity className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          Operations Console
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Monitor event queue status, model routing, resource usage, approvals, recent runs, and local memory activity.
        </p>
      </div>

      <div className="min-h-[420px] flex-1">
        <OperationsConsole />
      </div>
    </div>
  );
}
