"use client";

import React from "react";

export default function TerminalMemorySplit() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="glass-panel p-4">
        <div className="text-sm font-semibold text-white">Terminal</div>
        <div className="mt-3 h-48 overflow-auto rounded-md bg-black/20 p-3 text-xs font-mono text-white/70">
          $ ssh deploy@infra
          <br />$ ./run-deploy --canary
          <br />[INFO] Canary passed, promoting release
        </div>
      </div>

      <div className="glass-panel p-4">
        <div className="text-sm font-semibold text-white">Memory Graph</div>
        <div className="mt-3 h-48 rounded-md bg-gradient-to-br from-black/5 to-black/10 p-4 text-xs text-white/70">
          <div className="mb-2 text-white/80">Interconnected nodes</div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-md bg-white/4 p-2 text-center">Repositories</div>
            <div className="rounded-md bg-white/4 p-2 text-center">Workflows</div>
            <div className="rounded-md bg-white/4 p-2 text-center">Projects</div>
            <div className="rounded-md bg-white/4 p-2 text-center">Preferences</div>
            <div className="rounded-md bg-white/4 p-2 text-center">History</div>
            <div className="rounded-md bg-white/4 p-2 text-center">Integrations</div>
          </div>
        </div>
      </div>
    </div>
  );
}
