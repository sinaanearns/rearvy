"use client";

import React from "react";

export default function ReasoningEngine() {
  const lines = [
    "Retrieving latest metrics...",
    "Detecting anomaly in checkout funnel",
    "Evaluating remediation strategies",
    "Preparing concise executive summary",
  ];

  return (
    <div className="rounded-md border border-white/6 bg-gradient-to-b from-black/0 to-white/2 p-3 text-xs text-white/70 font-mono cinematic-glow">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-white">Reasoning Engine</div>
        <div className="text-xs text-white/60">Real-time</div>
      </div>

      <div className="mt-2 space-y-1">
        {lines.map((line, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-white/10" />
            <div className={idx === lines.length - 1 ? "text-white" : "text-white/60"}>{line}</div>
            {idx === lines.length - 1 && <div className="ml-2 h-3 w-3 animate-pulse rounded-full bg-emerald-300" />}
          </div>
        ))}
      </div>
    </div>
  );
}
