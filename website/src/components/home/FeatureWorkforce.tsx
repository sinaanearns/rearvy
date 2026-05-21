"use client";

import React from "react";
import { User, Users, Brain, Shield, RefreshCw } from "lucide-react";

export default function FeatureWorkforce() {
  return (
    <div className="w-full aspect-square max-w-[280px] mx-auto relative flex items-center justify-center bg-white/[0.002] border border-white/5 rounded-2xl p-6 overflow-hidden">
      
      {/* Dynamic Grid Background Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.03),transparent_70%)] pointer-events-none" />

      {/* Pulsing Central Ring */}
      <div className="absolute w-24 h-24 rounded-full border border-emerald-500/10 bg-emerald-500/[0.01] animate-ping opacity-60" />

      {/* Orbit paths */}
      <div className="absolute w-36 h-36 rounded-full border border-dashed border-white/5 animate-[spin_40s_linear_infinite]" />
      <div className="absolute w-48 h-48 rounded-full border border-dashed border-white/5 animate-[spin_60s_linear_infinite_reverse]" />

      {/* Central Node removed per request (logo) */}

      {/* Outer Connected Nodes */}
      
      {/* Node 1: Manager Agent (Top) */}
      <div 
        className="absolute top-[12%] left-[50%] transform -translate-x-1/2 flex flex-col items-center gap-1 group"
        style={{ animation: "floatUp 6s ease-in-out infinite" }}
      >
        <div className="w-9 h-9 rounded-full border border-white/10 bg-[#090f1d] flex items-center justify-center text-emerald-400 shadow-lg group-hover:border-emerald-500/30 transition-colors">
          <Brain size={15} />
        </div>
        <span className="text-[7.5px] font-bold text-white/40 tracking-widest uppercase">Manager</span>
      </div>

      {/* Node 2: Operations Agent (Right) */}
      <div 
        className="absolute right-[10%] top-[40%] transform -translate-y-1/2 flex flex-col items-center gap-1 group"
        style={{ animation: "floatUp 8s ease-in-out infinite" }}
      >
        <div className="w-9 h-9 rounded-full border border-white/10 bg-[#090f1d] flex items-center justify-center text-emerald-400 shadow-lg group-hover:border-emerald-500/30 transition-colors">
          <RefreshCw size={14} className="animate-spin [animation-duration:12s]" />
        </div>
        <span className="text-[7.5px] font-bold text-white/40 tracking-widest uppercase">Ops</span>
      </div>

      {/* Node 3: Ad-Agent (Bottom Right) */}
      <div 
        className="absolute right-[20%] bottom-[12%] flex flex-col items-center gap-1 group"
        style={{ animation: "floatUp 7s ease-in-out infinite" }}
      >
        <div className="w-9 h-9 rounded-full border border-white/10 bg-[#090f1d] flex items-center justify-center text-emerald-400 shadow-lg group-hover:border-emerald-500/30 transition-colors">
          <Users size={14} />
        </div>
        <span className="text-[7.5px] font-bold text-white/40 tracking-widest uppercase">Ads</span>
      </div>

      {/* Node 4: Product Agent (Bottom Left) */}
      <div 
        className="absolute left-[20%] bottom-[12%] flex flex-col items-center gap-1 group"
        style={{ animation: "floatUp 9s ease-in-out infinite" }}
      >
        <div className="w-9 h-9 rounded-full border border-white/10 bg-[#090f1d] flex items-center justify-center text-emerald-400 shadow-lg group-hover:border-emerald-500/30 transition-colors">
          <User size={14} />
        </div>
        <span className="text-[7.5px] font-bold text-white/40 tracking-widest uppercase">Product</span>
      </div>

      {/* Node 5: Sec Agent (Left) */}
      <div 
        className="absolute left-[10%] top-[40%] transform -translate-y-1/2 flex flex-col items-center gap-1 group"
        style={{ animation: "floatUp 6.5s ease-in-out infinite" }}
      >
        <div className="w-9 h-9 rounded-full border border-white/10 bg-[#090f1d] flex items-center justify-center text-emerald-400 shadow-lg group-hover:border-emerald-500/30 transition-colors">
          <Shield size={14} />
        </div>
        <span className="text-[7.5px] font-bold text-white/40 tracking-widest uppercase">Security</span>
      </div>

      {/* Connection Lines using simple absolute-positioned glowing nodes */}
      <div className="absolute top-[28%] left-[50%] w-[1px] h-10 bg-gradient-to-t from-emerald-500/40 to-transparent" />
      <div className="absolute bottom-[28%] right-[32%] w-10 h-[1px] bg-gradient-to-l from-emerald-500/40 to-transparent rotate-[30deg]" />
      <div className="absolute bottom-[28%] left-[32%] w-10 h-[1px] bg-gradient-to-r from-emerald-500/40 to-transparent -rotate-[30deg]" />
      <div className="absolute top-[45%] right-[22%] w-10 h-[1px] bg-gradient-to-l from-emerald-500/40 to-transparent" />
      <div className="absolute top-[45%] left-[22%] w-10 h-[1px] bg-gradient-to-r from-emerald-500/40 to-transparent" />

    </div>
  );
}
