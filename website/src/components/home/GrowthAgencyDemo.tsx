"use client";

import React from "react";
import { BarChart3, TrendingUp, Users, AlertCircle, CheckCircle2 } from "lucide-react";

export default function GrowthAgencyDemo() {
  return (
    <div className="relative w-full max-w-[560px]">
      {/* Main dashboard window */}
      <div className="glass-panel p-4 cinematic-glow">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <div className="text-sm font-semibold text-white">Client Campaign Dashboard</div>
            <div className="text-xs text-white/60 mt-1">3 active clients • 8 campaigns • synced in real-time</div>
          </div>
          <div className="text-emerald-300 text-xs font-medium flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </div>
        </div>

        {/* Metrics row */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-white/10 bg-white/2 p-3">
            <div className="text-xs text-white/70 flex items-center gap-1">
              <TrendingUp size={14} />
              Campaign ROI
            </div>
            <div className="text-2xl font-bold text-white mt-2">3.2x</div>
            <div className="text-xs text-emerald-300 mt-1">↑ 14% vs last month</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/2 p-3">
            <div className="text-xs text-white/70 flex items-center gap-1">
              <Users size={14} />
              Ad Spend
            </div>
            <div className="text-2xl font-bold text-white mt-2">$48k</div>
            <div className="text-xs text-blue-300 mt-1">Across all platforms</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/2 p-3">
            <div className="text-xs text-white/70 flex items-center gap-1">
              <BarChart3 size={14} />
              Conversions
            </div>
            <div className="text-2xl font-bold text-white mt-2">1,247</div>
            <div className="text-xs text-emerald-300 mt-1">↑ 28% this week</div>
          </div>
        </div>

        {/* Client cards */}
        <div className="mt-4 space-y-2">
          <div className="rounded-lg border border-white/10 bg-white/2 p-3 hover:bg-white/3 transition cursor-pointer">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium text-white">TechFlow Inc.</div>
                <div className="text-xs text-white/60 mt-1">Instagram + Facebook campaign</div>
              </div>
              <CheckCircle2 size={18} className="text-emerald-400" />
            </div>
            <div className="flex gap-4 mt-2 text-xs">
              <span className="text-white/70">ROAS: <span className="text-emerald-300 font-medium">2.8x</span></span>
              <span className="text-white/70">CPM: <span className="text-blue-300 font-medium">$1.24</span></span>
            </div>
          </div>

          <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 hover:bg-amber-400/15 transition cursor-pointer">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium text-white">RetailHub Co.</div>
                <div className="text-xs text-white/60 mt-1">Google Ads + Shopify campaign</div>
              </div>
              <AlertCircle size={18} className="text-amber-300" />
            </div>
            <div className="flex gap-4 mt-2 text-xs">
              <span className="text-white/70">ROAS: <span className="text-amber-300 font-medium">1.9x</span> — Budget check needed</span>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/2 p-3 hover:bg-white/3 transition cursor-pointer">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium text-white">GrowthScale Labs</div>
                <div className="text-xs text-white/60 mt-1">LinkedIn + Email campaign</div>
              </div>
              <CheckCircle2 size={18} className="text-emerald-400" />
            </div>
            <div className="flex gap-4 mt-2 text-xs">
              <span className="text-white/70">CTR: <span className="text-blue-300 font-medium">3.2%</span></span>
              <span className="text-white/70">Cost/Lead: <span className="text-emerald-300 font-medium">$18</span></span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-4 pt-3 border-t border-white/10 flex gap-2">
          <button className="flex-1 px-3 py-2 rounded-md text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 transition">
            Review Alerts
          </button>
          <button className="flex-1 px-3 py-2 rounded-md text-xs font-medium border border-white/20 text-white/90 hover:bg-white/5 transition">
            Export Report
          </button>
        </div>
      </div>

      {/* Floating panel: Real-time sync */}
      <div className="absolute -right-16 top-12 w-40 glass-panel p-3 cinematic-glow">
        <div className="text-xs font-semibold text-white/85 mb-2">Live Sync</div>
        <div className="space-y-1 text-xs text-white/70">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Shopify → synced</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Google Ads → synced</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Instagram → synced</span>
          </div>
        </div>
      </div>
    </div>
  );
}
