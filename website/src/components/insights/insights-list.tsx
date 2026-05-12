"use client";

import { AITraderConnector } from "./ai-trader-connector";
import { TradingProjectInsights } from "./trading-project-insights";
import { InsightsMap } from "./insights-map";

export function InsightsList() {
  return (
    <div className="space-y-10">
      <InsightsMap />
      <AITraderConnector />
      <TradingProjectInsights />
    </div>
  );
}
