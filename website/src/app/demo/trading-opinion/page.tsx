import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  BadgeDollarSign,
  CheckCircle2,
  CirclePlay,
  Clock3,
  LineChart,
  MousePointerClick,
  Radar,
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

const demoGuardrails = [
  {
    label: "Fixed setup",
    value: "No live dependency",
    icon: LineChart,
  },
  {
    label: "Review mode",
    value: "Controls are visible before action",
    icon: CheckCircle2,
  },
  {
    label: "Risk notice",
    value: "Demo-only, not financial advice",
    icon: ShieldAlert,
  },
];

const scenarioSteps = [
  {
    step: "01",
    title: "Read the setup",
    detail: "A fixed BTC/USD opinion shows the signal, levels, and research context.",
    icon: Radar,
  },
  {
    step: "02",
    title: "Review the risk box",
    detail: "Entry, stop, target, and invalidation stay visible before monitor actions.",
    icon: ShieldAlert,
  },
  {
    step: "03",
    title: "Preview monitor controls",
    detail: "Start and stop flows can be inspected without relying on live conditions.",
    icon: MousePointerClick,
  },
] as const;

export default function DemoTradingOpinionPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <section className="relative overflow-hidden rounded-[8px] border border-slate-900/10 bg-slate-950 px-5 py-8 text-white shadow-sm shadow-slate-950/20 sm:px-8">
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(116deg,rgba(16,185,129,0.2),transparent_34%),linear-gradient(248deg,rgba(247,201,72,0.14),transparent_40%),repeating-linear-gradient(90deg,rgba(255,255,255,0.04)_0_1px,transparent_1px_72px)]"
        />
        <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(320px,0.48fr)] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-[8px] border border-white/12 bg-white/10 px-3 py-1.5 text-sm font-medium text-white/72 shadow-sm shadow-black/10">
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
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-white px-5 text-sm font-semibold text-slate-950 transition hover:bg-white/85"
              >
                Create account
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/download"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border border-white/24 px-5 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/10"
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
                    <p className="text-[11px] font-medium text-white/62">
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

      <section className="grid gap-3 rounded-[8px] border border-white/10 bg-white/[0.055] p-3 text-white shadow-sm shadow-black/20 backdrop-blur-xl md:grid-cols-3">
        {scenarioSteps.map((item) => {
          const Icon = item.icon;

          return (
            <article
              key={item.step}
              className="grid min-h-[132px] grid-cols-[42px_minmax(0,1fr)] gap-3 rounded-[8px] border border-white/10 bg-black/24 p-4"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-emerald-200/18 bg-emerald-200/10 text-emerald-100">
                <Icon className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white/46">{item.step}</p>
                <h2 className="mt-2 text-base font-semibold leading-tight text-white">
                  {item.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-white/64">{item.detail}</p>
              </div>
            </article>
          );
        })}
      </section>

      <section className="relative overflow-hidden rounded-[8px] border border-slate-900/10 bg-slate-950 p-3 text-white shadow-sm shadow-slate-950/20 sm:p-5">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(116deg,rgba(16,185,129,0.16),transparent_32%),linear-gradient(248deg,rgba(105,215,255,0.13),transparent_36%),repeating-linear-gradient(90deg,rgba(255,255,255,0.035)_0_1px,transparent_1px_76px)]"
        />
        <div className="relative z-10 border-b border-white/10 px-2 pb-4 sm:px-3">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-[8px] border border-white/12 bg-white/[0.07] px-3 py-1 text-xs font-medium text-white/68">
                <Activity className="h-3.5 w-3.5 text-emerald-200" aria-hidden />
                Monitor preview
              </div>
              <h2 className="mt-3 max-w-2xl text-2xl font-semibold leading-tight tracking-tight text-white sm:text-3xl">
                Inspect the opinion card exactly where monitor controls live.
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm sm:flex">
              {[
                ["BTC/USD", "Symbol"],
                ["H1", "Timeframe"],
              ].map(([value, label]) => (
                <div
                  key={label}
                  className="rounded-[8px] border border-white/10 bg-white/[0.06] px-3 py-2"
                >
                  <p className="font-semibold leading-none text-white">{value}</p>
                  <p className="mt-1 text-[11px] font-medium text-white/58">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_290px]">
          <div className="min-w-0 rounded-[8px] border border-white/10 bg-background/95 p-3 text-foreground shadow-sm shadow-black/20 sm:p-5">
            <TradingOpinionCard opinion={sampleOpinion} chatId="demo-trading-opinion" />
          </div>

          <aside className="grid content-start gap-3">
            <div className="rounded-[8px] border border-amber-300/24 bg-amber-300/10 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-100">
                <ShieldAlert className="h-4 w-4" aria-hidden />
                Demo boundary
              </div>
              <p className="mt-3 text-sm leading-6 text-white/68">
                Demo-only scenario. This is not financial advice or a live recommendation.
              </p>
            </div>

            {demoGuardrails.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.label}
                  className="grid grid-cols-[38px_minmax(0,1fr)] gap-3 rounded-[8px] border border-white/10 bg-white/[0.06] p-3 backdrop-blur-xl"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-white/12 bg-white/10 text-cyan-100">
                    <Icon className="h-4 w-4" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-white/58">{item.label}</p>
                    <p className="mt-1 text-sm font-semibold leading-5 text-white">{item.value}</p>
                  </div>
                </div>
              );
            })}

            <div className="rounded-[8px] border border-white/10 bg-black/24 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Clock3 className="h-4 w-4 text-emerald-200" aria-hidden />
                Preview flow
              </div>
              <p className="mt-3 text-sm leading-6 text-white/62">
                Use this page to see the monitor experience before connecting live market data.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
