"use client";

import { TradingProjectInsights } from "./trading-project-insights";
import { InsightsMap } from "./insights-map";

export function InsightsList() {
  return (
    <div className="space-y-10">
      <InsightsMap />
      <TradingProjectInsights />
    </div>
  );
}
