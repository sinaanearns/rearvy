"use client";

import React from "react";
import { Clock3 } from "lucide-react";
import type { AutomationEvent } from "@/components/automation/types";

export function AWCurrentWork({
  timeline,
  formatTime,
  eventsEndRef,
}: {
  timeline: AutomationEvent[];
  formatTime: (timestamp: number) => string;
  eventsEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
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
  );
}
