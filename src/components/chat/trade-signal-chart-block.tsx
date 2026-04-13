"use client";

import { useMemo } from "react";
import TradingViewMiniChart from "@/components/data-cards/tradingview-mini-chart";
import type { Timeframe, TradingAction } from "@/types/trading";

type TradeSignalChartConfig = {
  title?: string;
  subtitle?: string;
  symbol?: string;
  timeframe?: Timeframe;
  action?: TradingAction;
  confidence?: number;
  entry?: number;
  stopLoss?: number;
  takeProfit?: number;
};

function safeParseConfig(configText: string): TradeSignalChartConfig {
  try {
    const parsed = JSON.parse(configText) as TradeSignalChartConfig;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return parsed;
  } catch {
    return {};
  }
}

function normalizeTimeframe(value: unknown): Timeframe {
  if (value === "M15" || value === "M30" || value === "H1" || value === "H4" || value === "D1" || value === "W1") {
    return value;
  }

  return "H1";
}

function normalizeAction(value: unknown): TradingAction {
  if (value === "Buy" || value === "Sell" || value === "Hold") {
    return value;
  }

  return "Hold";
}

function formatConfidence(confidence?: number): string {
  if (typeof confidence !== "number" || !Number.isFinite(confidence)) {
    return "--";
  }

  return `${Math.round(confidence * 100)}%`;
}

export function TradeSignalChartBlock({ configText }: { configText: string }) {
  const config = useMemo(() => safeParseConfig(configText), [configText]);
  const symbol = typeof config.symbol === "string" && config.symbol.trim() ? config.symbol.trim() : null;
  const timeframe = normalizeTimeframe(config.timeframe);
  const action = normalizeAction(config.action);

  if (!symbol) {
    return null;
  }

  const title = config.title || `${symbol} ${action}`;
  const subtitle =
    config.subtitle ||
    `Best verified signal · Confidence ${formatConfidence(config.confidence)}`;

  return (
    <div className="overflow-hidden rounded-3xl border border-border/60 bg-background/70 shadow-sm">
      <div className="border-b border-border/60 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Verified trader chart
            </p>
            <h3 className="mt-1 text-lg font-semibold text-foreground">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-full border border-border/60 bg-muted/50 px-2.5 py-1 text-muted-foreground">
              {timeframe}
            </span>
            <span
              className={
                action === "Buy"
                  ? "rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-600"
                  : action === "Sell"
                    ? "rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-rose-600"
                    : "rounded-full border border-border/60 bg-muted/50 px-2.5 py-1 text-muted-foreground"
              }
            >
              {action}
            </span>
          </div>
        </div>
      </div>

      <TradingViewMiniChart
        symbol={symbol}
        timeframe={timeframe}
        action={action}
        confidence={typeof config.confidence === "number" ? config.confidence : 0}
        entry={config.entry}
        stopLoss={config.stopLoss}
        takeProfit={config.takeProfit}
      />
    </div>
  );
}
