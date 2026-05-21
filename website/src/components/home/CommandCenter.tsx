"use client";

import React, { useEffect, useState } from "react";
import { animate } from "animejs";
import { 
  TrendingUp, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert,
  ArrowRight,
  Sparkles,
  ShoppingBag,
  PlusCircle
} from "lucide-react";
import { SlidingNumber } from "@/components/ui/sliding-number";

export default function CommandCenter() {
  const [reasoningProgress, setReasoningProgress] = useState(0);

  useEffect(() => {
    const runSequence = () => {
      // Reset state values
      setReasoningProgress(0);

      // Reset card positions and opacity
      animate(".anime-cc-dashboard", { opacity: [0, 1], scale: [0.98, 1], duration: 600, ease: "outQuad" });
      animate(".anime-cc-supplier-switch", { opacity: [0, 1], translateY: [-10, 0], scale: [0.95, 1], duration: 500, delay: 800, ease: "outBack" });
      animate(".anime-cc-reasoning-bubble", { opacity: [0, 1], translateY: [10, 0], scale: [0.95, 1], duration: 500, delay: 1500, ease: "outBack" });
      animate(".anime-cc-risk-bubble", { opacity: [0, 1], translateY: [15, 0], scale: [0.95, 1], duration: 550, delay: 2200, ease: "outBack" });
      animate(".anime-cc-margin-bubble", { opacity: [0, 1], translateY: [10, 0], scale: [0.95, 1], duration: 500, delay: 2900, ease: "outBack" });

      // Animate the reasoning progress bar
      setTimeout(() => {
        let currentConf = 0;
        const confInterval = setInterval(() => {
          currentConf += 2;
          if (currentConf >= 87) {
            setReasoningProgress(87);
            clearInterval(confInterval);
          } else {
            setReasoningProgress(currentConf);
          }
        }, 15);
      }, 1500);
    };

    runSequence();
    // Loop the subtle entrance overlays sequence
    const animInterval = setInterval(runSequence, 12000);

    return () => {
      clearInterval(animInterval);
    };
  }, []);

  return (
    <div className="w-full h-full text-white font-sans relative select-none overflow-hidden lg:overflow-visible">
      {/* Background shadow glow */}
      <div className="absolute -inset-10 bg-emerald-500/5 blur-3xl rounded-full opacity-60 pointer-events-none" />

      {/* Main Command Center Container */}
      <div className="anime-cc-dashboard opacity-0 w-full h-full rounded-xl lg:rounded-2xl border border-white/5 bg-black/95 p-3 sm:p-4 lg:p-5 shadow-2xl relative z-10 backdrop-blur-md flex flex-col justify-between">
        
        {/* Header Row */}
        <div className="flex items-center justify-between border-b border-white/5 pb-2.5 lg:pb-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] sm:text-[12px] font-black tracking-wider text-emerald-400 uppercase">Rearvy Command Center</span>
            <span className="hidden sm:flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-400 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          </div>
          <div className="hidden lg:flex items-center gap-2 text-[10px] text-white/40 font-mono">
            <span>OS Version 2.0.4</span>
          </div>
        </div>

        {/* 4 KPIs Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 lg:gap-3 mt-3 lg:mt-4">
          {/* KPI 1 */}
          <div className="rounded-xl border border-white/5 bg-white/[0.01] p-2.5 lg:p-3 relative group overflow-hidden">
            <div className="text-[9px] text-white/40 font-medium uppercase tracking-wider">Total Revenue</div>
            <div className="text-[14px] sm:text-[16px] lg:text-[17px] font-black text-white mt-0.5 flex items-center">
              <span>$</span>
              <SlidingNumber 
                number={12426818} 
                fromNumber={12426500} 
                thousandSeparator="," 
                inView={true} 
                transition={{ stiffness: 80, damping: 15, mass: 1 }} 
              />
            </div>
            <div className="text-[8px] sm:text-[9px] text-emerald-400 font-semibold mt-1 flex items-center gap-0.5">
              <TrendingUp size={10} /> +24.6% <span className="text-white/20 ml-0.5">vs last 30d</span>
            </div>
            {/* Sparkline */}
            <div className="h-4 w-full mt-2 opacity-50 group-hover:opacity-80 transition-opacity">
              <svg className="w-full h-full" viewBox="0 0 100 20" preserveAspectRatio="none">
                <path d="M0,15 L20,10 L40,14 L60,5 L80,9 L100,2" fill="none" stroke="#10b981" strokeWidth="1.5" />
              </svg>
            </div>
          </div>

          {/* KPI 2 */}
          <div className="rounded-xl border border-white/5 bg-white/[0.01] p-2.5 lg:p-3 relative group overflow-hidden">
            <div className="text-[9px] text-white/40 font-medium uppercase tracking-wider">Orders</div>
            <div className="text-[14px] sm:text-[16px] lg:text-[17px] font-black text-white mt-0.5 flex items-center">
              <SlidingNumber 
                number={21583} 
                fromNumber={21500} 
                thousandSeparator="," 
                inView={true} 
                transition={{ stiffness: 85, damping: 15, mass: 1 }} 
              />
            </div>
            <div className="text-[8px] sm:text-[9px] text-emerald-400 font-semibold mt-1 flex items-center gap-0.5">
              <TrendingUp size={10} /> +18.2% <span className="text-white/20 ml-0.5">vs last 30d</span>
            </div>
            {/* Sparkline */}
            <div className="h-4 w-full mt-2 opacity-50 group-hover:opacity-80 transition-opacity">
              <svg className="w-full h-full" viewBox="0 0 100 20" preserveAspectRatio="none">
                <path d="M0,14 L20,16 L40,8 L60,11 L80,4 L100,6" fill="none" stroke="#10b981" strokeWidth="1.5" />
              </svg>
            </div>
          </div>

          {/* KPI 3 */}
          <div className="rounded-xl border border-white/5 bg-white/[0.01] p-2.5 lg:p-3 relative group overflow-hidden">
            <div className="text-[9px] text-white/40 font-medium uppercase tracking-wider">Profit Margin</div>
            <div className="text-[14px] sm:text-[16px] lg:text-[17px] font-black text-white mt-0.5 flex items-center">
              <SlidingNumber 
                number={32.7} 
                fromNumber={30.0} 
                decimalPlaces={1} 
                inView={true} 
                transition={{ stiffness: 90, damping: 15, mass: 1 }} 
              />
              <span>%</span>
            </div>
            <div className="text-[8px] sm:text-[9px] text-emerald-400 font-semibold mt-1 flex items-center gap-0.5">
              <TrendingUp size={10} /> +3.6% <span className="text-white/20 ml-0.5">vs last 30d</span>
            </div>
            {/* Sparkline */}
            <div className="h-4 w-full mt-2 opacity-50 group-hover:opacity-80 transition-opacity">
              <svg className="w-full h-full" viewBox="0 0 100 20" preserveAspectRatio="none">
                <path d="M0,10 L20,8 L40,11 L60,6 L80,8 L100,3" fill="none" stroke="#10b981" strokeWidth="1.5" />
              </svg>
            </div>
          </div>

          {/* KPI 4 */}
          <div className="rounded-xl border border-white/5 bg-white/[0.01] p-2.5 lg:p-3 relative group overflow-hidden">
            <div className="text-[9px] text-white/40 font-medium uppercase tracking-wider">Active Agents</div>
            <div className="text-[14px] sm:text-[16px] lg:text-[17px] font-black text-white mt-0.5 flex items-center">
              <SlidingNumber 
                number={24} 
                fromNumber={0} 
                inView={true} 
                transition={{ stiffness: 100, damping: 15, mass: 1 }} 
              />
            </div>
            <div className="text-[7px] sm:text-[8px] text-emerald-400 font-bold mt-1 uppercase tracking-wider flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded w-max max-w-full border border-emerald-500/15">
              All systems operational
            </div>
            {/* Sine wave animation */}
            <div className="h-4 w-full mt-2 opacity-40">
              <svg className="w-full h-full" viewBox="0 0 100 20" preserveAspectRatio="none">
                <path d="M0,10 Q12.5,0 25,10 T50,10 T75,10 T100,10" fill="none" stroke="#10b981" strokeWidth="1.2" strokeDasharray="3 2" className="animate-[dash_8s_linear_infinite]" />
              </svg>
            </div>
          </div>
        </div>

        {/* Chart and Live Feed Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-3 lg:gap-4 mt-3 lg:mt-4 flex-1 min-h-0 lg:min-h-[220px]">
          
          {/* Left panel: Revenue Over Time Grid Chart */}
          <div className="bg-white/[0.005] border border-white/5 rounded-xl p-3 lg:p-4 flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-white/70 tracking-wide uppercase">Revenue Over Time</span>
              <span className="text-[9px] text-white/50 bg-white/5 px-2 py-0.5 rounded border border-white/10">30 Days</span>
            </div>

            {/* Custom SVG line chart */}
            <div className="w-full flex-1 relative mt-2 min-h-[120px] lg:min-h-[140px]">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 100 40" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Horizontal Grid lines */}
                <line x1="0" y1="10" x2="100" y2="10" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
                <line x1="0" y1="20" x2="100" y2="20" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
                <line x1="0" y1="30" x2="100" y2="30" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
                
                {/* Area Gradient */}
                <path d="M 5 32 L 27.5 28 L 50 30 L 72.5 18 L 95 8 L 95 40 L 5 40 Z" fill="url(#chartGradient)" />
                
                {/* Glowing Stroke line */}
                <path d="M 5 32 L 27.5 28 L 50 30 L 72.5 18 L 95 8" fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" />
                
                {/* Circular glowing nodes */}
                <circle cx="5" cy="32" r="1.5" fill="#10b981" />
                <circle cx="27.5" cy="28" r="1.5" fill="#10b981" />
                <circle cx="50" cy="30" r="1.5" fill="#10b981" />
                <circle cx="72.5" cy="18" r="1.5" fill="#10b981" />
                <circle cx="95" cy="8" r="1.5" fill="#10b981" />
              </svg>

              {/* Pulsing dot aligned precisely on the last chart node (95% left, 8/40 = 20% top) */}
              <div 
                className="absolute w-2.5 h-2.5 bg-emerald-400 rounded-full -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none"
                style={{ left: "95%", top: "20%" }}
              >
                <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-75" />
                <div className="w-1.5 h-1.5 bg-black border border-emerald-400 rounded-full" />
              </div>

              {/* Chart Annotations */}
              <div className="absolute left-0 bottom-0 right-0 px-[5%] flex justify-between text-[8px] text-white/30 font-mono pt-1">
                <span>May 11</span>
                <span>May 18</span>
                <span>May 25</span>
                <span>Jun 1</span>
                <span>Jun 8</span>
              </div>

              {/* Tooltip Overlay */}
              <div 
                className="absolute bg-[#050505] border border-emerald-500/20 px-2 py-1 rounded shadow-lg text-[9px] pointer-events-none transform -translate-x-1/2 -translate-y-full flex flex-col gap-0.5"
                style={{ left: "72.5%", top: "45%" }}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-white/40 font-mono">Jun 1</span>
                  <span className="text-emerald-400 font-bold">$2.85M</span>
                </div>
                <div className="text-[7.5px] text-emerald-400/80 font-bold">+24.6% growth</div>
              </div>
            </div>
          </div>

          {/* Right panel: Live Activity Feed */}
          <div className="hidden lg:flex bg-white/[0.005] border border-white/5 rounded-xl p-4 flex-col justify-between">
            <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
              <span className="text-[11px] font-bold text-white/70 tracking-wide uppercase">Live Activity Feed</span>
              <span className="text-[8px] text-white/40 hover:text-white transition-colors cursor-pointer bg-white/5 px-2 py-0.5 rounded border border-white/10">View all</span>
            </div>

            {/* Scrolling Activity Feed items */}
            <div className="space-y-3 flex-1 overflow-hidden">
              
              {/* Item 1 */}
              <div className="flex items-start gap-2.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                  <Sparkles size={11} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold text-white/90 truncate">TikTok campaign launched</span>
                    <span className="text-[8px] text-white/40 shrink-0 font-mono">2m ago</span>
                  </div>
                  <div className="text-[8.5px] text-white/50 truncate mt-0.5">
                    Agency Auto-Ads Agent | Generated 4 creative videos.
                  </div>
                </div>
              </div>

              {/* Item 2 */}
              <div className="flex items-start gap-2.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                  <ShoppingBag size={11} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold text-white/90 truncate">New product added</span>
                    <span className="text-[8px] text-white/40 shrink-0 font-mono">5m ago</span>
                  </div>
                  <div className="text-[8.5px] text-white/50 truncate mt-0.5">
                    "Wireless Earbuds B2" pushed to Shopify & Meta.
                  </div>
                </div>
              </div>

              {/* Item 3 */}
              <div className="flex items-start gap-2.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 shrink-0">
                  <ShieldAlert size={11} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold text-white/90 truncate">Inventory risk detected</span>
                    <span className="text-[8px] text-white/40 shrink-0 font-mono">8m ago</span>
                  </div>
                  <div className="text-[8.5px] text-red-400/70 truncate mt-0.5">
                    Wireless Earbuds stock level low (8 units remaining).
                  </div>
                </div>
              </div>

              {/* Item 4 */}
              <div className="flex items-start gap-2.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                  <CheckCircle2 size={11} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold text-white/90 truncate">Ad budget optimized</span>
                    <span className="text-[8px] text-white/40 shrink-0 font-mono">12m ago</span>
                  </div>
                  <div className="text-[8.5px] text-white/50 truncate mt-0.5">
                    Transferred $450/day to top performing TikTok sets.
                  </div>
                </div>
              </div>

              {/* Item 5 */}
              <div className="flex items-start gap-2.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                  <PlusCircle size={11} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold text-white/90 truncate">Customer support handled</span>
                    <span className="text-[8px] text-white/40 shrink-0 font-mono">18m ago</span>
                  </div>
                  <div className="text-[8.5px] text-white/50 truncate mt-0.5">
                    Autonomous Support Agent | Responded to refund query.
                  </div>
                </div>
              </div>

              {/* View Completed Tasks count */}
              <div className="text-[8.5px] font-bold text-emerald-400/80 hover:text-emerald-300 cursor-pointer pt-1 flex items-center gap-1">
                <span>+ 19 more tasks completed today</span>
                <ArrowRight size={10} />
              </div>

            </div>
          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* FLOATING CARD OVERLAYS (EXACT POSITIONING MATCHING THE SCREENSHOT) */}
      {/* ========================================================================= */}

      {/* 1. Top Right Overlay: "Supplier switched automatically" */}
      <div className="anime-cc-supplier-switch opacity-0 absolute top-3 right-3 w-[154px] sm:w-[200px] lg:top-[-6%] lg:right-[-6%] lg:w-[210px] rounded-xl border border-white/5 bg-black/95 p-2.5 sm:p-3 lg:p-3.5 shadow-2xl z-20 backdrop-blur-md">
        <div className="flex items-start gap-2 sm:gap-2.5 text-[9.5px] sm:text-[10px]">
          <div className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
            <CheckCircle2 size={13} className="text-emerald-400 animate-pulse" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="font-black text-white tracking-wide">Supplier switched automatically</div>
            <div className="text-[9px] text-emerald-400 font-bold flex items-center gap-0.5">
              Saved $3,240
            </div>
          </div>
        </div>
      </div>

      {/* 2. Bottom Left Overlay: "AI Reasoning" */}
      <div className="anime-cc-reasoning-bubble opacity-0 hidden lg:block absolute bottom-[18%] left-[-15%] w-[210px] rounded-xl border border-emerald-500/20 bg-black/95 p-3.5 shadow-2xl z-20 backdrop-blur-md">
        <div className="text-[10px] space-y-2">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-black tracking-wider uppercase text-[9px]">AI Reasoning</span>
          </div>
          <p className="text-[9px] text-white/60 leading-relaxed font-medium">
            Analyzing competitor pricing patterns and market trends...
          </p>
          <div className="flex items-center justify-between gap-3 pt-1 text-[8px] text-white/40">
            <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
              <div 
                className="h-full bg-emerald-400 rounded-full transition-all duration-300"
                style={{ width: `${reasoningProgress}%` }}
              />
            </div>
            <span className="font-bold text-emerald-400">{reasoningProgress}%</span>
          </div>
        </div>
      </div>

      {/* 3. Bottom Center Overlay: "Inventory Risk Detected" */}
      <div className="anime-cc-risk-bubble opacity-0 hidden lg:block absolute bottom-[-10%] left-[28%] w-[230px] rounded-xl border border-red-500/20 bg-black/95 p-3.5 shadow-2xl z-20 backdrop-blur-md">
        <div className="flex items-start gap-2.5 text-[10px]">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 shrink-0">
            <AlertTriangle size={13} className="text-red-400 animate-pulse" />
          </div>
          <div className="space-y-1.5">
            <div className="font-black text-red-200 tracking-wide">Inventory Risk Detected</div>
            <p className="text-[8.5px] text-white/50 leading-relaxed">
              Wireless Earbuds stock low. Reorder recommended.
            </p>
            <button className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[8px] font-extrabold px-3 py-1 rounded transition-colors border border-red-500/20">
              View Details
            </button>
          </div>
        </div>
      </div>

      {/* 4. Bottom Right Overlay: "Profit Margin Optimized" */}
      <div className="anime-cc-margin-bubble opacity-0 absolute bottom-3 right-3 w-[190px] sm:w-[210px] lg:bottom-[-5%] lg:right-[-10%] rounded-xl border border-emerald-500/20 bg-black/95 p-3 lg:p-3.5 shadow-2xl z-20 backdrop-blur-md">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-black text-emerald-400 uppercase tracking-wider text-[9px]">Profit Margin Optimized</span>
          </div>
          <div className="text-[9px] text-white/60 font-medium">Increased by 12% in the last 24h</div>
          
          {/* Small spark chart */}
          <div className="h-8 w-full mt-2">
            <svg className="w-full h-full" viewBox="0 0 100 20" preserveAspectRatio="none">
              <path d="M0,15 L15,13 L30,17 L45,10 L60,12 L75,5 L90,8 L100,2" fill="none" stroke="#10b981" strokeWidth="1.5" />
            </svg>
          </div>
        </div>
      </div>

    </div>
  );
}
