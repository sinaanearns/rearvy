"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, MessageSquare, TrendingUp } from "lucide-react";

export default function SceneChat() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 500),   // User starts typing/showing prompt
      setTimeout(() => setStep(2), 1500),  // AI thinking indicator
      setTimeout(() => setStep(3), 2800),  // AI starts responding text
      setTimeout(() => setStep(4), 3800),  // Margin breakdown card fades in
      setTimeout(() => setStep(5), 7500),  // Loop reset trigger
    ];

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [step === 5]); // Reset cycle

  useEffect(() => {
    if (step === 5) {
      setStep(0);
    }
  }, [step]);

  return (
    <div className="w-full h-full flex flex-col justify-between rounded-2xl border border-emerald-500/10 bg-[#07090d]/90 p-5 shadow-[0_20px_50px_rgba(4,120,87,0.15)] backdrop-blur-md">
      {/* Mock Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
            <Sparkles size={14} className="text-emerald-400" />
          </div>
          <div>
            <div className="text-xs font-semibold text-white/90">Rearvy Decision Copilot</div>
            <div className="text-[10px] text-white/40">Model: Gemini 3.5 Flash</div>
          </div>
        </div>
        <div className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-300">
          Agent Active
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 mt-4 space-y-4 overflow-hidden text-xs">
        {/* User Message */}
        {step >= 1 && (
          <div className="flex justify-end animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="max-w-[85%] rounded-2xl bg-white/5 border border-white/10 px-3.5 py-2 text-white/80">
              <p className="leading-5">What is our highest-margin product today?</p>
            </div>
          </div>
        )}

        {/* AI Typing Indicator */}
        {step === 2 && (
          <div className="flex items-start gap-2.5">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-600/20 text-emerald-400">
              <Sparkles size={12} />
            </div>
            <div className="rounded-2xl bg-[#0a0f1d] border border-emerald-500/10 px-3.5 py-2.5 text-white/60">
              <div className="flex gap-1.5 items-center py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce" />
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.2s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}

        {/* AI Response Text */}
        {step >= 3 && (
          <div className="flex items-start gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-600/20 text-emerald-400">
              <Sparkles size={12} />
            </div>
            <div className="space-y-3 flex-1">
              <div className="rounded-2xl bg-[#0a0f1d] border border-emerald-500/10 px-3.5 py-2 text-white/85 leading-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                I've compiled your live margin analysis. Here are today's top-performing product lines:
              </div>

              {/* Data Card */}
              {step >= 4 && (
                <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-b from-[#0e1624] to-[#0a0f1a] p-4 shadow-[0_10px_30px_rgba(217,119,6,0.05)] animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp size={13} className="text-amber-400" />
                      <span className="font-semibold text-amber-200">Margin Breakdown</span>
                    </div>
                    <span className="text-[10px] text-white/40">Shopify Data • Live</span>
                  </div>

                  <div className="mt-3 space-y-2.5">
                    {/* Item 1 */}
                    <div>
                      <div className="flex justify-between text-[11px] font-medium mb-1">
                        <span className="text-white/80">Apex Sneakers</span>
                        <span className="text-amber-300 font-bold">74% margin</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-600 to-amber-400 rounded-full transition-all duration-1000 ease-out" 
                          style={{ width: "74%" }}
                        />
                      </div>
                    </div>

                    {/* Item 2 */}
                    <div>
                      <div className="flex justify-between text-[11px] font-medium mb-1">
                        <span className="text-white/80">Summit Jacket</span>
                        <span className="text-emerald-400">62% margin</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out" 
                          style={{ width: "62%" }}
                        />
                      </div>
                    </div>

                    {/* Item 3 */}
                    <div>
                      <div className="flex justify-between text-[11px] font-medium mb-1">
                        <span className="text-white/80">Active Socks</span>
                        <span className="text-white/45">48% margin</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                        <div 
                          className="h-full bg-white/20 rounded-full transition-all duration-1000 ease-out" 
                          style={{ width: "48%" }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
