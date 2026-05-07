"use client";

import React from "react";

type Props = {
  name: string;
  task?: string;
};

export default function AgentCard({ name, task }: Props) {
  return (
    <div className="glass-panel flex items-start gap-3 p-3">
      <div className="h-9 w-9 flex-shrink-0 rounded-full bg-gradient-to-br from-[var(--rearvy-electric-violet)] to-[var(--rearvy-neon-blue)]/60 p-1 text-white/95 flex items-center justify-center font-semibold">
        {name.split(" ")[0].charAt(0)}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-white">{name}</div>
          <div className="text-xs text-white/60">{task ?? "Idle"}</div>
        </div>
        <div className="mt-2 h-2 w-full rounded-full bg-white/6">
          <div className="h-2 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300" style={{ width: "46%" }} />
        </div>
        <div className="mt-2 text-xs text-white/60">Logs: Connecting to api.rearvy.local...</div>
      </div>
    </div>
  );
}
