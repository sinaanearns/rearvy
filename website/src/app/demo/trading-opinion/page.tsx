import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  BadgeDollarSign,
  CirclePlay,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";

import TradingOpinionCard from "@/components/data-cards/trading-opinion-card";
import type { TradingOpinion } from "@/types/trading";

export const metadata: Metadata = {
  title: "Trading Opinion Demo | Rearvy",
  description:
    "Preview Rearvy trading opinion monitor controls with a fixed demo scenario and no live market dependency.",
};

const sampleOpinion: TradingOpinion = {
  action: "Buy",
  confidence: 0.82,
  reason:
    "Demo scenario: BTC/USD shows a constructive trend, enough signal strength, and a defined risk box for previewing monitor controls.",
  symbol: "BTC/USD",
  timeframe: "H1",
  entry: 71250,
  stopLoss: 70500,
  takeProfit: 72900,
  riskNotes:
    "Demo-only scenario. This is not financial advice or a live recommendation.",
  fetchedAt: Date.now(),
  marketDataSource: "Rearvy demo page",
  practicalAnalysis:
    "Use this page to preview the Start Monitor and Stop Monitor experience without waiting for live market conditions.",
  supportLevel: 70550,
  resistanceLevel: 72850,
  invalidationLevel: 70390,
  setupType: "trend",
  researchBias: "bullish",
  researchSummary:
    "Fixed demo scenario for product preview only. Not a live recommendation.",
  researchSources: [
    {
      title: "Rearvy demo source",
      url: "https://www.rearvy.com/demo/trading-opinion",
      source: "Rearvy demo",
    },
  ],
  newsSentimentScore: 0.65,
  newsBullishCount: 2,
  newsBearishCount: 0,
  newsConsensus: 0.84,
  sessionId: "demo-trading-opinion",
  model: "demo-preview",
};

export default function DemoTradingOpinionPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <section className="relative overflow-hidden rounded-[8px] border border-slate-900/10 bg-slate-950 px-5 py-8 text-white shadow-[0_24px_80px_rgba(15,23,42,0.22)] sm:px-8">
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(116deg,rgba(16,185,129,0.2),transparent_34%),linear-gradient(248deg,rgba(247,201,72,0.14),transparent_40%),repeating-linear-gradient(90deg,rgba(255,255,255,0.04)_0_1px,transparent_1px_72px)]"
        />
        <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(320px,0.48fr)] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-white/68">
              <CirclePlay className="h-3.5 w-3.5 text-emerald-200" aria-hidden />
              Product demo
            </div>
            <h1 className="mt-5 max-w-3xl text-balance text-[clamp(36px,6vw,72px)] font-semibold leading-[0.95] tracking-normal">
              Trading opinion monitor demo.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/68">
              Preview the monitor controls with a fixed BTC/USD scenario, without waiting for live
              market conditions.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="/signup"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-slate-950 transition hover:bg-white/85"
              >
                Create account
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/download"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/24 px-5 text-sm font-semibold text-white transition hover:border-white hover:bg-white hover:text-slate-950"
              >
                Download app
              </Link>
            </div>
          </div>

          <div className="grid gap-3">
            {[
              {
                label: "Signal",
                value: "Buy preview",
                icon: TrendingUp,
                color: "text-emerald-200",
              },
              {
                label: "Risk",
                value: "Demo only",
                icon: ShieldAlert,
                color: "text-amber-200",
              },
              {
                label: "Market",
                value: "BTC/USD H1",
                icon: BadgeDollarSign,
                color: "text-cyan-200",
              },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.label}
                  className="grid min-h-[76px] grid-cols-[38px_minmax(0,1fr)] items-center gap-3 rounded-[8px] border border-white/10 bg-white/[0.07] p-3 backdrop-blur-xl"
                >
                  <div className={`flex h-9 w-9 items-center justify-center rounded-[8px] border border-white/12 bg-white/10 ${item.color}`}>
                    <Icon className="h-4 w-4" aria-hidden />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/42">
                      {item.label}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-white">{item.value}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-[8px] border border-border/70 bg-background/95 p-3 shadow-[0_18px_54px_rgba(15,23,42,0.12)] sm:p-5">
        <TradingOpinionCard opinion={sampleOpinion} chatId="demo-trading-opinion" />
      </section>

      <div className="rounded-[8px] border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-900 dark:text-amber-100">
        Demo-only scenario. This is not financial advice or a live recommendation.
      </div>
    </div>
  );
}
