"use client";

import React from "react";
import AgentCard from "./AgentCard";
import ReasoningEngine from "./ReasoningEngine";

export default function LiveInterfacePanel() {
  return (
    <div className="relative w-full max-w-[520px]">
      <div className="absolute -left-12 -top-8 w-48 transform rotate-6 glass-panel floating-panel p-3 cinematic-glow">
        <div className="text-xs font-semibold text-white/85">Browser</div>
        <div className="mt-2 h-24 w-full rounded-md bg-white/3" />
      </div>

      <div className="absolute right-0 top-6 w-56 glass-panel p-3 cinematic-glow">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-white/85">Terminal</div>
          <div className="text-emerald-300 text-xs">● running</div>
        </div>
        <div className="mt-2 h-28 w-full rounded-md bg-gradient-to-b from-black/0 to-white/2 p-3 text-xs text-white/70 font-mono">
          $ git fetch --all
          <br />$ yarn run monitor:cycle
        </div>
      </div>

      <div className="relative z-10 mx-auto w-[420px]">
        <div className="glass-panel p-3 cinematic-glow">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-white">Live AI Interface</div>
            <div className="text-xs text-white/60">Multi-agent • real-time</div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-md border border-white/6 bg-white/3 p-2 text-xs">
              <div className="font-medium text-white">Workflow</div>
              <div className="mt-2 text-white/70 text-xs">Deploy Canary → Verify → Rollout</div>
            </div>
            <div className="rounded-md border border-white/6 bg-white/3 p-2 text-xs">
              <div className="font-medium text-white">Memory</div>
              <div className="mt-2 text-white/70 text-xs">Syncing repos • 3 nodes</div>
            </div>
          </div>

          <div className="mt-3">
            <ReasoningEngine />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <AgentCard name="Dev Agent" task="Running tests" />
          <AgentCard name="Ops Agent" task="Checking infra" />
        </div>
      </div>
    </div>
  );
}
