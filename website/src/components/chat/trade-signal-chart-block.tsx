"use client";

import { useMemo } from "react";
import TradingViewMiniChart from "@/components/data-cards/tradingview-mini-chart";
import { normalizeTradeSignalChartConfig } from "./trade-signal-chart-config";
import {
  formatTradeSignalConfidence,
} from "./trade-signal-confidence";

export function TradeSignalChartBlock({ configText }: { configText: string }) {
  const config = useMemo(() => normalizeTradeSignalChartConfig(configText), [configText]);

  if (!config) {
    return null;
  }

  const title = config.title || `${config.symbol} ${config.action}`;
  const subtitle =
    config.subtitle ||
    `Best verified signal - Confidence ${formatTradeSignalConfidence(config.confidence)}`;

  return (
    <div className="overflow-hidden rounded-[8px] border border-border/60 bg-background/70 shadow-sm">
      <div className="border-b border-border/60 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Verified trader chart
            </p>
            <h3 className="mt-1 text-lg font-semibold text-foreground">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-[8px] border border-border/60 bg-muted/50 px-2.5 py-1 text-muted-foreground">
              {config.timeframe}
            </span>
            <span
              className={
                config.action === "Buy"
                  ? "rounded-[8px] border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-600"
                  : config.action === "Sell"
                    ? "rounded-[8px] border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-rose-600"
                    : "rounded-[8px] border border-border/60 bg-muted/50 px-2.5 py-1 text-muted-foreground"
              }
            >
              {config.action}
            </span>
          </div>
        </div>
      </div>

      <TradingViewMiniChart
        symbol={config.symbol}
        timeframe={config.timeframe}
        action={config.action}
        confidence={config.confidence ?? 0}
        entry={config.entry}
        stopLoss={config.stopLoss}
        takeProfit={config.takeProfit}
      />
    </div>
  );
}
