"use client";

import React, { useState, useEffect } from "react";
import { Mic, Zap, Keyboard, BarChart3, AlertCircle, Play } from "lucide-react";

export default function SceneVoice() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 500),   // Show shortcut key trigger
      setTimeout(() => setStep(2), 1800),  // Open HUD overlay + voice waveform
      setTimeout(() => setStep(3), 3200),  // Type voice text prompt
      setTimeout(() => setStep(4), 5000),  // Render executive pipeline brief
      setTimeout(() => setStep(5), 9500),  // Reset trigger
    ];

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [step === 5]);

  useEffect(() => {
    if (step === 5) {
      setStep(0);
    }
  }, [step]);

  return (
    <div className="w-full h-full flex flex-col justify-between rounded-2xl border border-emerald-500/10 bg-[#07090d]/90 p-5 shadow-[0_20px_50px_rgba(4,120,87,0.15)] backdrop-blur-md overflow-hidden text-xs relative">
      
      {/* Background Desktop Grid Wireframe */}
      <div className="absolute inset-0 opacity-15 pointer-events-none bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:16px_16px] -z-10" />

      {/* Mock Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-amber-400" />
          <span className="text-[10px] text-white/40 font-mono">Rearvy background client active</span>
        </div>
        <span className="text-[9px] text-white/30 font-mono">v2.1.2</span>
      </div>

      {/* Center workspace */}
      <div className="flex-1 flex flex-col justify-center items-center relative mt-3 select-none">
        
        {/* Step 0/1: Key shortcut trigger */}
        {step <= 1 && (
          <div className="flex flex-col items-center gap-3 animate-in fade-in duration-300">
            <Keyboard size={32} className="text-white/20" />
            <div className="text-[10px] text-white/50">Press shortcut from any window</div>
            <div className="flex gap-2">
              <span className={`px-2.5 py-1.5 rounded-lg border font-mono font-bold text-xs shadow-md transition-all duration-300 ${
                step === 1 ? "border-amber-400 bg-amber-400/20 text-amber-200 scale-105" : "border-white/10 bg-white/5 text-white/45"
              }`}>Alt</span>
              <span className="text-white/20 self-center">+</span>
              <span className={`px-3 py-1.5 rounded-lg border font-mono font-bold text-xs shadow-md transition-all duration-300 ${
                step === 1 ? "border-amber-400 bg-amber-400/20 text-amber-200 scale-105" : "border-white/10 bg-white/5 text-white/45"
              }`}>Space</span>
            </div>
          </div>
        )}

        {/* Step 2 & 3: Overlay Dialog with Oscillating Waveform */}
        {step >= 2 && step < 4 && (
          <div className="w-full max-w-[90%] rounded-xl border border-amber-500/25 bg-[#0a0f1c]/90 p-4 shadow-[0_15px_40px_rgba(217,119,6,0.15)] flex flex-col items-center gap-4 animate-in zoom-in-95 duration-300">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-[10px] uppercase tracking-widest">
              <Mic size={12} className="animate-pulse" />
              <span>Voice listening...</span>
            </div>

            {/* Glowing Golden Waveform simulation */}
            <div className="flex items-end justify-center gap-1 h-8 w-full">
              {[6, 12, 24, 18, 8, 14, 28, 20, 10, 16, 22, 12, 6].map((h, i) => (
                <span 
                  key={i} 
                  className="w-1 bg-amber-400 rounded-full transition-all duration-300 animate-pulse" 
                  style={{ 
                    height: `${step === 3 ? h * 0.4 : h}px`,
                    animationDelay: `${i * 0.08}s`
                  }} 
                />
              ))}
            </div>

            {/* Prompt Transcription text */}
            <div className="text-[10px] text-white/90 text-center font-medium h-5 font-mono">
              {step === 3 ? (
                <span className="animate-in fade-in duration-300">
                  "Rearvy, summarize our pipeline and alerts today."
                </span>
              ) : (
                <span className="text-white/30">Speak now...</span>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Executive Pipeline Brief Card */}
        {step >= 4 && (
          <div className="w-full max-w-[95%] rounded-xl border border-emerald-500/25 bg-[#081017] p-4 shadow-[0_15px_40px_rgba(16,185,129,0.15)] animate-in slide-in-from-bottom-3 duration-400">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <div className="flex items-center gap-1.5">
                <Zap size={13} className="text-emerald-400" />
                <span className="font-bold text-emerald-200">Rearvy Executive HUD</span>
              </div>
              <span className="text-[9px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full">Pipeline active</span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <div className="p-2 rounded-lg bg-white/2 border border-white/5">
                <div className="text-[8px] uppercase tracking-wider text-white/40">Today's Revenue</div>
                <div className="text-base font-bold text-white mt-1">$124.5k</div>
                <div className="text-[9px] text-emerald-400 mt-0.5 font-semibold">↑ 12% above goal</div>
              </div>
              <div className="p-2 rounded-lg bg-white/2 border border-white/5">
                <div className="text-[8px] uppercase tracking-wider text-white/40">Active Alerts</div>
                <div className="text-base font-bold text-white mt-1">2</div>
                <div className="text-[9px] text-amber-300 mt-0.5 font-semibold">Resolved autonomously</div>
              </div>
            </div>

            <div className="mt-2.5 p-2 rounded-lg bg-black/40 border border-white/5 text-[9px] text-white/60 leading-relaxed font-mono">
              <span className="text-amber-400 font-semibold">Summary:</span> Ad spend optimized, low stock replenishment PO generated. Everything stable.
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
