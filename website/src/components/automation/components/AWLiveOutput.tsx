"use client";

import React from "react";
import { Button } from "@/components/ui/button";

export function AWLiveOutput({ commandOutput, onClear }: { commandOutput: string[]; onClear: () => void }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-950 p-4 text-slate-100 dark:border-slate-800">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Live output</h2>
        <Button variant="ghost" className="h-8 px-2 text-xs text-slate-300 hover:bg-slate-900 hover:text-white" onClick={onClear}>Clear</Button>
      </div>
      <div className="max-h-64 overflow-auto rounded-xl bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-emerald-300">
        {commandOutput.length === 0 ? (
          <div className="text-slate-500">Awaiting background output...</div>
        ) : commandOutput.map((line, index) => <div key={`${index}-${line}`}>{line}</div>)}
      </div>
    </section>
  );
}
