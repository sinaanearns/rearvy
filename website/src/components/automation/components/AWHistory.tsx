"use client";

import React from "react";
import { History } from "lucide-react";
import type { AutomationTask } from "@/components/automation/types";
import { AWEmptyState } from "@/components/automation/components/AWEmptyState";

export function AWHistory({
  tasks,
  activeTask,
  onSelectTask,
}: {
  tasks: AutomationTask[];
  activeTask: AutomationTask | null;
  onSelectTask: (task: AutomationTask) => void;
}) {
  return (
    <section className="rounded-[8px] border border-slate-200 bg-white shadow-sm shadow-slate-950/[0.03] dark:border-slate-800 dark:bg-slate-950">
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Work history</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">Recent background tasks saved on this device.</p>
      </div>
      <div className="max-h-80 space-y-3 overflow-auto p-4">
        {tasks.length === 0 ? (
          <AWEmptyState
            compact
            icon={History}
            title="No saved history yet"
            detail="Completed background tasks will be saved here so you can rerun or inspect recent automation work."
            tone="emerald"
          />
        ) : tasks.map((task) => (
          <button
            key={task.id}
            type="button"
            className={`w-full rounded-[8px] border px-3 py-3 text-left transition-colors ${activeTask?.id === task.id ? "border-blue-500 bg-blue-500/5" : "border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:bg-slate-900"}`}
            onClick={() => onSelectTask(task)}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{task.title}</div>
              <span className="text-xs font-medium capitalize text-slate-400">{task.status}</span>
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{task.command}</div>
          </button>
        ))}
      </div>
    </section>
  );
}
