"use client";

import TradingOpinionCard from "@/components/data-cards/trading-opinion-card";
import type { TradingOpinion } from "@/types/trading";

const sampleOpinion: TradingOpinion = {
  action: "Buy",
  confidence: 0.82,
  reason:
    "Demo validation setup: BTC/USD shows a constructive trend, enough signal strength, and a defined risk box for monitor testing.",
  symbol: "BTC/USD",
  timeframe: "H1",
  entry: 71250,
  stopLoss: 70500,
  takeProfit: 72900,
  riskNotes:
    "Demo-only validation setup. Use a small size and keep stop discipline tight while validating monitor controls.",
  fetchedAt: Date.now(),
  marketDataSource: "Demo validation page",
  practicalAnalysis:
    "Use this page to verify the Start Monitor and Stop Monitor UI without waiting for live market conditions.",
  supportLevel: 70550,
  resistanceLevel: 72850,
  invalidationLevel: 70390,
  setupType: "trend",
  researchBias: "bullish",
  researchSummary:
    "Synthetic validation setup for UI verification only. Not a live recommendation.",
  researchSources: [
    {
      title: "Demo validation source",
      url: "https://example.com/demo-trading-validation",
      source: "Rearvy demo",
    },
  ],
  newsSentimentScore: 0.65,
  newsBullishCount: 2,
  newsBearishCount: 0,
  newsConsensus: 0.84,
  sessionId: "demo-trading-validation",
  model: "demo-validation",
};

export default function DemoTradingOpinionPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Phase 1 UI validation
        </p>
        <h1 className="text-3xl font-bold tracking-tight">
          Trading opinion monitor demo
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          This page renders a fixed actionable opinion so the monitor controls can
          be tested without waiting for live market conditions to become actionable.
        </p>
      </div>

      <TradingOpinionCard opinion={sampleOpinion} chatId="demo-trading-validation" />
    </div>
  );
}
