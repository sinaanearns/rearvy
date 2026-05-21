"use client";

import React from "react";
import { Plus, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AWEditor({
  planDraft,
  setPlanDraft,
  commandDraft,
  setCommandDraft,
  onApplyEdit,
  onStartPlan,
  activeTask,
  workingDirectory,
}: {
  planDraft: string;
  setPlanDraft: (v: string) => void;
  commandDraft: string;
  setCommandDraft: (v: string) => void;
  onApplyEdit: () => void;
  onStartPlan: (e?: React.FormEvent) => void;
  activeTask: { id: string } | null;
  workingDirectory: string | null;
}) {
  return (
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

      <form className="space-y-3" onSubmit={onStartPlan}>
        <textarea
          value={planDraft}
          onChange={(event) => setPlanDraft(event.target.value)}
          className="min-h-24 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
          placeholder="Describe the automation work you want Rearvy to do..."
        />

        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <Input
            value={commandDraft}
            onChange={(event: any) => setCommandDraft(event.target.value)}
            placeholder={workingDirectory ? `Run in ${workingDirectory}` : "Background action to execute"}
            className="h-11 rounded-xl border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
          />

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={onApplyEdit}><Plus className="mr-2 h-4 w-4" />Apply Edit</Button>
            <Button type="submit" className="h-11 rounded-xl bg-blue-600 text-white hover:bg-blue-700"><Play className="mr-2 h-4 w-4" />Start</Button>
          </div>
        </div>
      </form>
    </section>
  );
}
