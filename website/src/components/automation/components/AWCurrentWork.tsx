"use client";

import React from "react";
import { Clock3 } from "lucide-react";
import type { AutomationEvent } from "@/components/automation/types";
import { AWEmptyState } from "@/components/automation/components/AWEmptyState";

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
    <section className="min-h-0 rounded-[8px] border border-slate-200 bg-white shadow-sm shadow-slate-950/[0.03] dark:border-slate-800 dark:bg-slate-950">
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
            <AWEmptyState
              icon={Clock3}
              title="No automation events yet"
              detail="Start a plan to see live bridge progress, approvals, pauses, and background work in this stream."
              tone="cyan"
            />
          ) : timeline.map((event) => (
            <article key={event.id} className="rounded-[8px] border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/40">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{event.title}</div>
                <span className="text-xs font-medium text-slate-400">{formatTime(event.timestamp)}</span>
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
