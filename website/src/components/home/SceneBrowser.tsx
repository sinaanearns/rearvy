"use client";

import React, { useState, useEffect } from "react";
import { Terminal, Globe, Search, ArrowRight, Check } from "lucide-react";

export default function SceneBrowser() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 800),   // Show initial prompt & launch agent
      setTimeout(() => setStep(2), 2200),  // Open simulated browser, load competitor
      setTimeout(() => setStep(3), 3600),  // Laser scanner runs
      setTimeout(() => setStep(4), 5000),  // Price extraction logs printed
      setTimeout(() => setStep(5), 6200),  // Comparison table compiled
      setTimeout(() => setStep(6), 9500),  // Reset trigger
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
    <div className="w-full h-full flex flex-col justify-between rounded-2xl border border-emerald-500/10 bg-[#07090d]/90 p-4 shadow-[0_20px_50px_rgba(4,120,87,0.15)] backdrop-blur-md overflow-hidden text-xs">
      
      {/* Mock Window Bar */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
        </div>
        <div className="text-[10px] text-white/40 font-mono">Agent Web-Scraper Layer</div>
        <div className="w-8" /> {/* Spacer */}
      </div>

      {/* Workspace Grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-3 mt-3 overflow-hidden h-[calc(100%-35px)]">
        
        {/* Left Side: AI Agent Console & Logs */}
        <div className="rounded-xl border border-white/5 bg-[#030407] p-3 flex flex-col justify-between font-mono text-[10px] leading-5 text-white/70 overflow-hidden">
          <div className="space-y-1.5 flex-1 overflow-y-auto">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <Terminal size={11} />
              <span>&gt; rearvy-agent audit --competitors</span>
            </div>

            {step >= 1 && (
              <div className="text-white/40 animate-in fade-in duration-200">
                [Agent] Task: Extract pricing data from Competitor Corp.<br />
                [Agent] Launching headless browser...
              </div>
            )}

            {step >= 2 && (
              <div className="text-amber-300 animate-in fade-in duration-200">
                [Browser] Navigating to http://competitor.com/pricing...<br />
                [Browser] Page loaded (1240ms). Locating pricing elements...
              </div>
            )}

            {step >= 3 && (
              <div className="text-emerald-400/90 animate-pulse">
                [Browser] Target table found. Scanning DOM table cells...
              </div>
            )}

            {step >= 4 && (
              <div className="text-white/80 animate-in fade-in duration-200">
                [Browser] Match: "Starter Plan" - $49/mo<br />
                [Browser] Match: "Growth Plan" - $99/mo<br />
                [Browser] Extracting data arrays... Done.
              </div>
            )}

            {step >= 5 && (
              <div className="text-emerald-400 font-semibold animate-in fade-in duration-200">
                [Agent] Scrape complete. Pricing comparison generated.
              </div>
            )}
          </div>

          {/* Scrape Result Output */}
          {step >= 5 && (
            <div className="mt-2.5 p-2 rounded-lg border border-amber-500/20 bg-amber-500/5 animate-in slide-in-from-bottom-2 duration-300">
              <div className="text-[10px] text-amber-200 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Comparison Compiled
              </div>
              <div className="grid grid-cols-3 gap-1 text-[9px] border-b border-white/5 pb-1 font-semibold text-white/90">
                <span>Tier</span>
                <span>Us</span>
                <span>Them</span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-[9px] pt-1 text-white/60">
                <span>Starter</span>
                <span className="text-emerald-400">$0</span>
                <span>$49</span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-[9px] text-white/60">
                <span>Growth</span>
                <span className="text-emerald-400">$29</span>
                <span>$99</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Simulated Browser Viewport */}
        <div className="rounded-xl border border-white/10 bg-[#0c101a] overflow-hidden flex flex-col relative">
          
          {/* Address Bar */}
          <div className="bg-white/5 border-b border-white/5 px-2.5 py-1.5 flex items-center gap-2">
            <Globe size={10} className="text-white/40" />
            <div className="bg-black/40 rounded px-2 py-0.5 text-[9px] text-white/50 flex-1 truncate font-mono">
              http://competitor.com/pricing
            </div>
            <Search size={10} className="text-white/40" />
          </div>

          {/* Browser Page Body */}
          <div className="p-3 flex-1 flex flex-col justify-center items-center relative select-none">
            
            {step < 2 ? (
              <div className="text-white/20 text-[9px] font-mono animate-pulse">Browser Standby</div>
            ) : (
              <div className="w-full space-y-2.5 animate-in fade-in duration-300">
                <div className="text-center font-bold text-white/80 text-[10px]">Competitor Pricing</div>
                
                <div className="grid grid-cols-2 gap-2 relative">
                  {/* Laser Scanning Line */}
                  {step === 3 && (
                    <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#34d399] animate-bounce z-20" />
                  )}

                  {/* Plan Card A */}
                  <div className={`p-2 rounded border transition-colors duration-300 ${
                    step >= 4 ? "border-amber-500/40 bg-amber-500/5 shadow-[0_0_8px_rgba(245,158,11,0.08)]" : "border-white/5 bg-white/2"
                  }`}>
                    <div className="font-semibold text-white/70 text-[9px]">Starter</div>
                    <div className="text-xs font-bold text-white mt-1">$49<span className="text-[8px] text-white/45">/mo</span></div>
                  </div>

                  {/* Plan Card B */}
                  <div className={`p-2 rounded border transition-colors duration-300 ${
                    step >= 4 ? "border-amber-500/40 bg-amber-500/5 shadow-[0_0_8px_rgba(245,158,11,0.08)]" : "border-white/5 bg-white/2"
                  }`}>
                    <div className="font-semibold text-white/70 text-[9px]">Growth</div>
                    <div className="text-xs font-bold text-white mt-1">$99<span className="text-[8px] text-white/45">/mo</span></div>
                  </div>
                </div>

                <div className="h-6 w-full rounded bg-white/2 flex items-center justify-between px-2 text-[8px] border border-white/5">
                  <span className="text-white/40">Enterprise custom solutions available</span>
                  <ArrowRight size={8} className="text-white/40" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
