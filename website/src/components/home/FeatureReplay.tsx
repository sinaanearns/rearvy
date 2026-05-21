"use client";

import React, { useState, useEffect } from "react";
import { Play, Pause, SkipBack, SkipForward, CheckCircle2, Clock } from "lucide-react";

export default function FeatureReplay() {
  const [isPlaying, setIsPlaying] = useState(true);
  const [seconds, setSeconds] = useState(151); // starts at 02:31 (151 seconds)
  const maxSeconds = 342; // ends at 05:42 (342 seconds)

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setSeconds((prev) => {
          if (prev >= maxSeconds) {
            return 0; // loop back
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Format MM:SS
  const formatTime = (timeInSecs: number) => {
    const mins = Math.floor(timeInSecs / 60);
    const secs = timeInSecs % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const progressPercent = (seconds / maxSeconds) * 100;

  return (
    <div className="w-full max-w-[280px] mx-auto rounded-2xl border border-white/5 bg-[#030712]/80 p-4 space-y-4 shadow-xl backdrop-blur-md relative overflow-hidden group">
      
      {/* Dynamic Background subtle grid */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.02),transparent_70%)] pointer-events-none" />

      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <div className="flex items-center gap-1.5 text-emerald-400">
          <Clock size={11} />
          <span className="font-black uppercase tracking-wider text-[8.5px]">Session Replay</span>
        </div>
        <span className="text-[7.5px] text-white/40 font-mono">Jun 12, 2026 - 10:42 PM</span>
      </div>

      {/* Replay action stack simulated list */}
      <div className="space-y-2.5">
        
        {/* Item 1 */}
        <div className="flex items-center justify-between rounded-lg bg-emerald-500/[0.02] border border-emerald-500/10 px-3 py-1.5 transition-all">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={11} className="text-emerald-400" />
            <span className="text-[9.5px] font-bold text-white/90">Store created</span>
          </div>
          <span className="text-[8px] text-white/40 font-mono">10:31 PM</span>
        </div>

        {/* Item 2 */}
        <div className="flex items-center justify-between rounded-lg bg-emerald-500/[0.02] border border-emerald-500/10 px-3 py-1.5 transition-all">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={11} className="text-emerald-400" />
            <span className="text-[9.5px] font-bold text-white/90">Product added</span>
          </div>
          <span className="text-[8px] text-white/40 font-mono">10:34 PM</span>
        </div>

        {/* Item 3 */}
        <div className="flex items-center justify-between rounded-lg bg-emerald-500/[0.02] border border-emerald-500/10 px-3 py-1.5 transition-all">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={11} className="text-emerald-400" />
            <span className="text-[9.5px] font-bold text-white/90">Campaign launched</span>
          </div>
          <span className="text-[8px] text-white/40 font-mono">10:36 PM</span>
        </div>

        {/* Item 4 */}
        <div className="flex items-center justify-between rounded-lg bg-emerald-500/[0.02] border border-emerald-500/10 px-3 py-1.5 transition-all">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={11} className="text-emerald-400" />
            <span className="text-[9.5px] font-bold text-white/90">Budget optimized</span>
          </div>
          <span className="text-[8px] text-white/40 font-mono">10:41 PM</span>
        </div>

      </div>

      {/* Media Player Scrubber bar & Timer */}
      <div className="space-y-2 pt-2 border-t border-white/5">
        <div className="flex items-center justify-between text-[8px] text-white/40 font-mono">
          <span>{formatTime(seconds)}</span>
          <span>{formatTime(maxSeconds)}</span>
        </div>

        {/* Scrubber tracker progress track */}
        <div className="h-1 w-full bg-white/5 rounded-full relative overflow-hidden cursor-pointer">
          <div 
            className="absolute h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Playback action control buttons row */}
      <div className="flex items-center justify-center gap-4.5 pt-1 text-white/60">
        <button 
          onClick={() => setSeconds(151)} 
          className="hover:text-emerald-400 transition-colors p-1"
          title="Restart"
        >
          <SkipBack size={12} />
        </button>

        <button 
          onClick={() => setIsPlaying(!isPlaying)} 
          className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center hover:bg-emerald-500/20 text-emerald-400 transition-all hover:scale-105"
        >
          {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" className="translate-x-[0.5px]" />}
        </button>

        <button 
          onClick={() => setSeconds((prev) => Math.min(prev + 30, maxSeconds))} 
          className="hover:text-emerald-400 transition-colors p-1"
          title="Forward 30s"
        >
          <SkipForward size={12} />
        </button>
      </div>

    </div>
  );
}
