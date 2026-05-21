"use client";

import React from "react";
import { ArrowUpRight, BarChart3, Bell, CheckCircle2, Clock3, Sparkles, Wallet, ShieldCheck } from "lucide-react";

const briefs = [
  {
    label: "Agency",
    title: "Retail client ROAS is slipping",
    detail: "Google Ads spend is up 18%, but conversion rate fell on two key campaigns.",
    tone: "from-cyan-400/20 to-blue-500/20",
  },
  {
    label: "SaaS",
    title: "Support spike after pricing change",
    detail: "Ticket volume is 3x normal and onboarding completion dropped on mobile.",
    tone: "from-violet-400/20 to-fuchsia-500/20",
  },
  {
    label: "E-commerce",
    title: "Top seller near stockout",
    detail: "Three SKUs are below reorder level and the best seller has 12 units left.",
    tone: "from-emerald-400/20 to-lime-500/20",
  },
];

export default function BusinessOutcomeBoard() {
  return (
    <div className="relative w-full max-w-[580px]">
      <div className="glass-panel cinematic-glow relative overflow-hidden border border-white/10 bg-white/[0.04] p-5 sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(51,209,255,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(138,43,226,0.14),transparent_32%)]" />

        <div className="relative flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/50">
              Rearvy decision board
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-white">
              What should happen next
            </div>
            <p className="mt-2 max-w-md text-sm leading-6 text-white/65">
              Rearvy turns live business signals into one clear brief, then surfaces the actions worth approving first.
            </p>
          </div>
          <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
            Live now
          </div>
        </div>

        <div className="relative mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4 shadow-[0_22px_60px_rgba(0,0,0,0.32)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/80">
                  Live signal stream
                </div>
                <div className="mt-1 text-lg font-semibold text-white">
                  Revenue, support, and stock in one view
                </div>
              </div>
              <BarChart3 className="h-5 w-5 text-cyan-200" />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Revenue</div>
                <div className="mt-2 text-2xl font-bold text-emerald-300">$48k</div>
                <div className="mt-1 text-xs text-emerald-300/90">+12% this month</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Alerts</div>
                <div className="mt-2 text-2xl font-bold text-amber-300">3</div>
                <div className="mt-1 text-xs text-amber-300/90">Needs review</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Confidence</div>
                <div className="mt-2 text-2xl font-bold text-cyan-200">94%</div>
                <div className="mt-1 text-xs text-cyan-200/90">High signal</div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/75 p-3">
              <div className="flex items-center justify-between gap-3 text-xs text-white/55">
                <span>Action velocity</span>
                <span>Last 7 days</span>
              </div>
              <svg aria-hidden="true" className="mt-3 h-28 w-full" viewBox="0 0 420 120" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="rearvyBoardFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity="0.42" />
                    <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0 92 C42 82 58 46 105 58 C150 70 164 30 210 38 C248 45 256 84 294 72 C334 58 356 32 420 26 L420 120 L0 120 Z" fill="url(#rearvyBoardFill)" />
                <path d="M0 92 C42 82 58 46 105 58 C150 70 164 30 210 38 C248 45 256 84 294 72 C334 58 356 32 420 26" fill="none" stroke="#34d399" strokeLinecap="round" strokeWidth="4" />
                <path d="M0 44 C48 40 72 54 112 50 C160 46 190 74 230 76 C282 80 308 88 350 78 C382 70 398 76 420 86" fill="none" stroke="#38bdf8" strokeDasharray="7 9" strokeLinecap="round" strokeWidth="3" />
              </svg>
            </div>
          </div>

          <div className="grid gap-3">
            {briefs.map((brief) => (
              <div key={brief.title} className={`rounded-2xl border border-white/10 bg-gradient-to-r ${brief.tone} p-4 backdrop-blur-sm`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
                    {brief.label}
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-white/60" />
                </div>
                <div className="mt-3 text-sm font-semibold text-white">{brief.title}</div>
                <div className="mt-1 text-sm leading-6 text-white/70">{brief.detail}</div>
              </div>
            ))}

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-xs font-medium text-white/60">
                  <Wallet className="h-4 w-4 text-emerald-300" />
                  Revenue watch
                </div>
                <div className="mt-2 text-2xl font-bold text-white">$48k</div>
                <div className="mt-1 text-xs text-emerald-300">+12% this month</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-xs font-medium text-white/60">
                  <Bell className="h-4 w-4 text-amber-300" />
                  Alerts
                </div>
                <div className="mt-2 text-2xl font-bold text-white">3</div>
                <div className="mt-1 text-xs text-amber-300">Needs review</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-xs font-medium text-white/60">
                  <ShieldCheck className="h-4 w-4 text-cyan-300" />
                  Confidence
                </div>
                <div className="mt-2 text-2xl font-bold text-white">94%</div>
                <div className="mt-1 text-xs text-cyan-300">High signal</div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Sparkles className="h-4 w-4 text-violet-300" />
                  Rearvy recommends
                </div>
                <div className="flex items-center gap-1 text-xs text-white/50">
                  <Clock3 className="h-3.5 w-3.5" />
                  Updated 4 min ago
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/75">
                  Pause the weak ad set and shift budget to the top performer.
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/75">
                  Trigger stock reorder and recovery email for the low-inventory SKU.
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100">
                  <CheckCircle2 className="h-4 w-4" />
                  Approve actions
                </button>
                <button className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/85 transition hover:bg-white/10">
                  View full brief
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
