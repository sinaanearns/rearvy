"use client";

import React from "react";
import { Database, Shield, Brain, Network, Share2, Layers } from "lucide-react";

export function LiveFeedPipelinesGraphic() {
  return (
    <div className="w-full h-[150px] relative overflow-hidden flex items-center justify-between px-6 bg-white/[0.01] border border-white/5 rounded-xl">
      {/* Sources list */}
      <div className="flex flex-col gap-3 z-10">
        <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-black/80 px-3 py-1.5 text-[10px] font-semibold text-white/70">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Shopify
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-black/80 px-3 py-1.5 text-[10px] font-semibold text-white/70">
          <span className="h-1.5 w-1.5 rounded-full bg-[#f59e0b] animate-pulse" />
          Analytics
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-black/80 px-3 py-1.5 text-[10px] font-semibold text-white/70">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
          Meta Ads
        </div>
      </div>

      {/* Central Connector Lines (SVG with glowing dashes) */}
      <div className="absolute inset-0 z-0">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          {/* Path 1 */}
          <path 
            d="M 100 45 C 150 45, 170 75, 230 75" 
            fill="none" 
            stroke="#10b981" 
            strokeWidth="1.5" 
            strokeOpacity="0.4"
            strokeDasharray="4 4"
            className="animate-[dash_6s_linear_infinite]"
          />
          {/* Path 2 */}
          <path 
            d="M 100 75 C 150 75, 170 75, 230 75" 
            fill="none" 
            stroke="#f59e0b" 
            strokeWidth="1.5" 
            strokeOpacity="0.4"
            strokeDasharray="4 4"
            className="animate-[dash_4s_linear_infinite]"
          />
          {/* Path 3 */}
          <path 
            d="M 100 105 C 150 105, 170 75, 230 75" 
            fill="none" 
            stroke="#3b82f6" 
            strokeWidth="1.5" 
            strokeOpacity="0.4"
            strokeDasharray="4 4"
            className="animate-[dash_5s_linear_infinite]"
          />
        </svg>
      </div>

      {/* Central Database Cylinder */}
      <div className="relative z-10 flex flex-col items-center justify-center mr-4">
        <div className="h-16 w-12 rounded-xl bg-gradient-to-b from-emerald-600/25 to-emerald-950/40 border-2 border-emerald-500/30 flex flex-col items-center justify-around py-2 shadow-[0_0_20px_rgba(16,185,129,0.15)] relative group">
          <div className="absolute -inset-1 bg-emerald-500/10 rounded-xl blur opacity-60 group-hover:opacity-100 transition-opacity" />
          <Database size={18} className="text-emerald-400 relative z-10" />
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping relative z-10" />
        </div>
      </div>

      <style jsx global>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -40;
          }
        }
      `}</style>
    </div>
  );
}

export function AgentReasoningLoopGraphic() {
  return (
    <div className="w-full h-[150px] relative overflow-hidden flex items-center justify-center bg-white/[0.01] border border-white/5 rounded-xl">
      {/* Central neural center */}
      <div className="relative h-12 w-12 rounded-full border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.2)]">
        <Brain size={18} className="text-emerald-400 animate-pulse" />
        {/* Orbital green dot */}
        <div className="absolute w-2 h-2 rounded-full bg-emerald-400 animate-[spin_5s_linear_infinite] origin-[28px_28px] top-[-12px] left-[-12px] shadow-[0_0_8px_#10b981]" />
      </div>

      {/* Loop Nodes */}
      <div className="absolute top-[15px] left-[50%] transform -translate-x-1/2 bg-black/80 border border-white/5 rounded px-2 py-0.5 text-[8px] font-bold text-white/60">
        Observe
      </div>
      <div className="absolute right-[20px] top-[50%] transform -translate-y-1/2 bg-black/80 border border-white/5 rounded px-2 py-0.5 text-[8px] font-bold text-white/60">
        Reason
      </div>
      <div className="absolute bottom-[15px] left-[50%] transform -translate-x-1/2 bg-black/80 border border-white/5 rounded px-2 py-0.5 text-[8px] font-bold text-white/60">
        Act
      </div>
      <div className="absolute left-[20px] top-[50%] transform -translate-y-1/2 bg-black/80 border border-white/5 rounded px-2 py-0.5 text-[8px] font-bold text-white/60">
        Verify
      </div>

      {/* SVG Connecting Circle */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[100px] h-[100px] rounded-full border border-dashed border-white/5 animate-[spin_30s_linear_infinite]" />
      </div>
    </div>
  );
}

export function ZeroTrustSandboxGraphic() {
  return (
    <div className="w-full h-[150px] relative overflow-hidden flex items-center justify-center bg-white/[0.01] border border-white/5 rounded-xl">
      {/* 3D Cryptographic Glass Cube */}
      <div className="relative w-16 h-16 flex items-center justify-center group">
        {/* Outer security rings */}
        <div className="absolute inset-0 rounded-full border border-dashed border-emerald-500/20 animate-[spin_10s_linear_infinite]" />
        <div className="absolute w-[80%] h-[80%] rounded-full border border-dashed border-[#f59e0b]/20 animate-[spin_8s_linear_infinite_reverse]" />

        {/* Isometric Cube Shape constructed in CSS */}
        <div className="w-10 h-10 rounded bg-gradient-to-tr from-emerald-600/30 to-emerald-950/40 border border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.2)] flex items-center justify-center relative z-10 group-hover:scale-105 transition-transform duration-300">
          <Shield size={16} className="text-emerald-400" />
        </div>
      </div>
    </div>
  );
}
