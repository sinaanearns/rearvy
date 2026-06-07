"use client";

import React from "react";
import { Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AWLiveOutput({ commandOutput, onClear }: { commandOutput: string[]; onClear: () => void }) {
  return (
    <section className="rounded-[8px] border border-slate-200 bg-slate-950 p-4 text-slate-100 shadow-sm shadow-slate-950/[0.03] dark:border-slate-800">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Live output</h2>
        <Button variant="ghost" className="h-8 rounded-[8px] px-2 text-xs text-slate-300 hover:bg-slate-900 hover:text-white" onClick={onClear}>Clear</Button>
      </div>
      <div className="max-h-64 overflow-auto rounded-[8px] bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-emerald-300">
        {commandOutput.length === 0 ? (
          <div className="flex min-h-20 items-center gap-3 rounded-[8px] border border-white/10 bg-white/[0.04] p-3 text-slate-400">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-emerald-300/20 bg-emerald-300/10 text-emerald-300">
              <Terminal className="h-4 w-4" aria-hidden />
            </span>
            <span>
              <span className="block font-sans text-sm font-semibold text-slate-200">Awaiting background output</span>
              <span className="mt-1 block font-sans text-xs leading-5 text-slate-500">
                Terminal logs and automation output will stream here while work is running.
              </span>
            </span>
          </div>
        ) : commandOutput.map((line, index) => <div key={`${index}-${line}`}>{line}</div>)}
      </div>
    </section>
  );
}
