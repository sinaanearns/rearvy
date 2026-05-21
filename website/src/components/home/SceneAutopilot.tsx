"use client";

import React, { useState, useEffect } from "react";
import { Play, AlertTriangle, Cpu, CheckCircle2, ChevronRight, FileText } from "lucide-react";

export default function SceneAutopilot() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 500),   // Show Low Stock alert
      setTimeout(() => setStep(2), 2000),  // Autopilot turns "On"
      setTimeout(() => setStep(3), 3200),  // AI resolves (fetching logs)
      setTimeout(() => setStep(4), 5000),  // PO Invoice slides in
      setTimeout(() => setStep(5), 6500),  // Success confirmation sent
      setTimeout(() => setStep(6), 9500),  // Loop reset
    ];

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [step === 6]);

  useEffect(() => {
    if (step === 6) {
      setStep(0);
    }
  }, [step]);

  return (
    <div className="w-full h-full flex flex-col justify-between rounded-2xl border border-emerald-500/10 bg-[#07090d]/90 p-5 shadow-[0_20px_50px_rgba(4,120,87,0.15)] backdrop-blur-md overflow-hidden text-xs">
      
      {/* Mock Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
            <Cpu size={14} className="text-emerald-400 animate-pulse" />
          </div>
          <div>
            <div className="text-xs font-semibold text-white/90">Autonomous Ops Hub</div>
            <div className="text-[10px] text-white/40">Autopilot Loops Active</div>
          </div>
        </div>

        {/* Autopilot Status Indicator */}
        <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[9px] font-semibold transition-colors duration-500 ${
          step >= 2 ? "bg-emerald-500/20 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.2)]" : "bg-white/5 text-white/40"
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full transition-all duration-500 ${
            step >= 2 ? "bg-emerald-400 animate-ping" : "bg-white/20"
          }`} />
          <span>{step >= 2 ? "Autopilot Enabled" : "Manual Mode"}</span>
        </div>
      </div>

      {/* Workspace Grid */}
      <div className="flex-1 mt-4 space-y-3 overflow-hidden">
        
        {/* Step 1: Alert Banner */}
        {step >= 1 && (
          <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-3 animate-in slide-in-from-top-2 duration-300">
            <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={15} />
            <div className="flex-1">
              <div className="font-semibold text-red-200">Critical Stockout Warning</div>
              <div className="text-white/60 text-[10px] mt-0.5">Item: SKU-904 "Apex Sneakers" has only 4 units remaining. Est. stockout: 14 hrs.</div>
            </div>
          </div>
        )}

        {/* Step 3: Autopilot Decision Engine */}
        {step >= 3 && (
          <div className="rounded-xl border border-white/5 bg-black/40 p-3 text-[10px] font-mono leading-5 text-white/60 animate-in fade-in duration-300">
            <div className="text-emerald-400 font-semibold flex items-center gap-1">
              <Cpu size={12} className="animate-spin duration-3000" />
              <span>AI Agent execution: Resolve SKU-904 Stockout</span>
            </div>
            <div className="mt-1 space-y-0.5 text-white/40">
              <div>&gt; Comparing suppliers: Supplier A ($18/unit) vs Supplier B ($20/unit)</div>
              <div>&gt; Supplier A selected. Lead time: 2 days. Pricing optimal.</div>
              <div>&gt; Generating purchase requisition for 100 units. total: $1,800.</div>
            </div>
          </div>
        )}

        {/* Step 4 & 5: Purchase Order Invoice Details & Confirmation overlay */}
        {step >= 4 && (
          <div className="relative">
            <div className="rounded-xl border border-amber-500/20 bg-[#0e1624]/90 p-3.5 shadow-lg animate-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <div className="flex items-center gap-1.5">
                  <FileText size={13} className="text-amber-400" />
                  <span className="font-bold text-amber-200">Purchase Order PO-9029</span>
                </div>
                <span className="text-[9px] text-white/40 font-mono">DRAFT APPROVED</span>
              </div>
              
              <div className="mt-2.5 grid grid-cols-[1.5fr_0.5fr_1fr] text-[10px] text-white/70 gap-y-1">
                <span className="text-white/40 font-semibold">Description</span>
                <span className="text-white/40 font-semibold text-center">Qty</span>
                <span className="text-white/40 font-semibold text-right">Price</span>
                
                <span>SKU-904 "Apex Sneakers"</span>
                <span className="text-center font-bold text-white">100</span>
                <span className="text-right text-emerald-400 font-medium">$1,800.00</span>
              </div>
            </div>

            {/* Step 5: Gold glow confirmation badge */}
            {step >= 5 && (
              <div className="absolute inset-0 bg-[#05070c]/80 rounded-xl flex flex-col justify-center items-center gap-2 border border-emerald-400/30 animate-in fade-in duration-300">
                <CheckCircle2 size={24} className="text-emerald-400 animate-bounce" />
                <div className="text-xs font-bold text-white">PO Sent to Supplier</div>
                <div className="text-[9px] text-white/40 font-mono">Order confirmed & synced to accounting</div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
