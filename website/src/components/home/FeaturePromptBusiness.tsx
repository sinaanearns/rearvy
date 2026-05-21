"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Check, ArrowRight } from "lucide-react";

export default function FeaturePromptBusiness() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 1200), // Ticks "Creating store"
      setTimeout(() => setStep(2), 2400), // Ticks "Researching products"
      setTimeout(() => setStep(3), 3600), // Ticks "Building brand"
      setTimeout(() => setStep(4), 4800), // Ticks "Launching ads"
      setTimeout(() => setStep(5), 7500), // Reset loop trigger
    ];

    return () => timers.forEach(clearTimeout);
  }, [step === 5]);

  useEffect(() => {
    if (step === 5) {
      setStep(0);
    }
  }, [step]);

  return (
    <div className="w-full max-w-[280px] mx-auto rounded-2xl border border-white/5 bg-[#030712]/80 p-4.5 space-y-4 shadow-xl backdrop-blur-md relative overflow-hidden group">
      
      {/* Background glow mesh */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.02),transparent_70%)] pointer-events-none" />

      {/* Main Prompt Bar Container */}
      <div className="rounded-xl border border-emerald-500/20 bg-[#070e1b]/95 p-3 flex items-start gap-2.5 shadow-[0_0_15px_rgba(16,185,129,0.08)] relative group-hover:border-emerald-500/35 transition-all">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
          <Sparkles size={12} className="animate-pulse" />
        </div>
        <div className="space-y-0.5">
          <div className="text-[7.5px] font-extrabold text-emerald-400 uppercase tracking-widest">Business Prompt</div>
          <p className="text-[10px] text-white/90 font-bold leading-normal font-sans">
            "Launch a luxury skincare brand targeting UAE."
          </p>
        </div>
      </div>

      {/* Active step check items stack */}
      <div className="space-y-3 pt-1">
        
        {/* Step 1: Creating store */}
        <div className="flex items-center justify-between text-[10px] text-white/80 transition-opacity">
          <div className="flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${step >= 1 ? "bg-emerald-400" : "bg-white/20"}`} />
            <span className={step >= 1 ? "text-white/60 line-through" : "text-white font-medium"}>Creating store</span>
          </div>
          {step >= 1 ? (
            <div className="w-4 h-4 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Check size={8} strokeWidth={3} />
            </div>
          ) : (
            <span className="text-[8px] text-white/20 font-mono">Pending</span>
          )}
        </div>

        {/* Step 2: Researching products */}
        <div className="flex items-center justify-between text-[10px] text-white/80 transition-opacity">
          <div className="flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${step >= 2 ? "bg-emerald-400" : "bg-white/20"}`} />
            <span className={step >= 2 ? "text-white/60 line-through" : "text-white font-medium"}>Researching products</span>
          </div>
          {step >= 2 ? (
            <div className="w-4 h-4 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Check size={8} strokeWidth={3} />
            </div>
          ) : step === 1 ? (
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping mr-1" />
          ) : (
            <span className="text-[8px] text-white/20 font-mono">Pending</span>
          )}
        </div>

        {/* Step 3: Building brand */}
        <div className="flex items-center justify-between text-[10px] text-white/80 transition-opacity">
          <div className="flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${step >= 3 ? "bg-emerald-400" : "bg-white/20"}`} />
            <span className={step >= 3 ? "text-white/60 line-through" : "text-white font-medium"}>Building brand</span>
          </div>
          {step >= 3 ? (
            <div className="w-4 h-4 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Check size={8} strokeWidth={3} />
            </div>
          ) : step === 2 ? (
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping mr-1" />
          ) : (
            <span className="text-[8px] text-white/20 font-mono">Pending</span>
          )}
        </div>

        {/* Step 4: Launching ads */}
        <div className="flex items-center justify-between text-[10px] text-white/80 transition-opacity">
          <div className="flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${step >= 4 ? "bg-emerald-400 animate-pulse" : "bg-white/20"}`} />
            <span className="text-white font-medium">Launching ads</span>
          </div>
          {step >= 4 ? (
            <div className="w-4 h-4 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Check size={8} strokeWidth={3} />
            </div>
          ) : step === 3 ? (
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping mr-1" />
          ) : (
            <span className="text-[8px] text-white/20 font-mono">Pending</span>
          )}
        </div>

      </div>

    </div>
  );
}
