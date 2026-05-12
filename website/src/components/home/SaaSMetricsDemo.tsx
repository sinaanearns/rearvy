"use client";

import React from "react";
import { TrendingDown, AlertTriangle, Users, LogIn, MessageSquare, CheckCircle2 } from "lucide-react";

export default function SaaSMetricsDemo() {
  return (
    <div className="relative w-full max-w-[560px]">
      {/* Main dashboard window */}
      <div className="glass-panel p-4 cinematic-glow">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <div className="text-sm font-semibold text-white">Product Operations Hub</div>
            <div className="text-xs text-white/60 mt-1">Metrics • Support • Revenue • Real-time alerts</div>
          </div>
          <div className="text-emerald-300 text-xs font-medium flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </div>
        </div>

        {/* Key metrics */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-white/10 bg-white/2 p-3">
            <div className="text-xs text-white/70 flex items-center gap-1">
              <Users size={14} />
              Active Users
            </div>
            <div className="text-2xl font-bold text-white mt-2">12.4k</div>
            <div className="text-xs text-emerald-300 mt-1">↑ 3.2% today</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/2 p-3">
            <div className="text-xs text-white/70 flex items-center gap-1">
              <LogIn size={14} />
              MRR
            </div>
            <div className="text-2xl font-bold text-white mt-2">$48.2k</div>
            <div className="text-xs text-emerald-300 mt-1">↑ 12% vs last month</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/2 p-3">
            <div className="text-xs text-white/70 flex items-center gap-1">
              <MessageSquare size={14} />
              Churn Rate
            </div>
            <div className="text-2xl font-bold text-white mt-2">2.1%</div>
            <div className="text-xs text-emerald-300 mt-1">↓ 0.4pp vs avg</div>
          </div>
        </div>

        {/* Alerts section */}
        <div className="mt-4">
          <div className="text-xs font-semibold text-white mb-2">This Week's Alerts</div>
          <div className="space-y-2">
            <div className="rounded-lg border border-red-400/30 bg-red-400/10 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-red-300 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-white">Unusual spike in support tickets</div>
                  <div className="text-xs text-white/70 mt-1">+340% surge detected. Top issue: Export feature bug</div>
                  <button className="text-xs text-red-300 font-medium mt-2 hover:underline">View detail & action</button>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3">
              <div className="flex items-start gap-2">
                <TrendingDown size={16} className="text-amber-300 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-white">Conversion rate dropped</div>
                  <div className="text-xs text-white/70 mt-1">Onboarding CTR fell 8% on Tuesday. Correlates with pricing page change</div>
                  <button className="text-xs text-amber-300 font-medium mt-2 hover:underline">View analytics</button>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-300 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-white">New cohort retention reached target</div>
                  <div className="text-xs text-white/70 mt-1">May cohort: 94% D30 retention. Great work on onboarding!</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-4 pt-3 border-t border-white/10 flex gap-2">
          <button className="flex-1 px-3 py-2 rounded-md text-xs font-medium bg-red-500 text-white hover:bg-red-600 transition">
            Address Alert
          </button>
          <button className="flex-1 px-3 py-2 rounded-md text-xs font-medium border border-white/20 text-white/90 hover:bg-white/5 transition">
            Full Dashboard
          </button>
        </div>
      </div>

      {/* Floating panel: Data sources */}
      <div className="absolute -right-16 top-12 w-40 glass-panel p-3 cinematic-glow">
        <div className="text-xs font-semibold text-white/85 mb-2">Data Sources</div>
        <div className="space-y-1 text-xs text-white/70">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <span>Analytics API</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <span>Stripe webhooks</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <span>Support inbox</span>
          </div>
        </div>
      </div>
    </div>
  );
}
