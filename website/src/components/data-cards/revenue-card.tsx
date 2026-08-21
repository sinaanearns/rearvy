"use client";

import { DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/utils/formatting";
import {
  DataCardFrame,
  DataCardMessage,
  DataMetricTile,
} from "./data-card-frame";

interface RevenueCardProps {
  data: {
    total?: number;
    previousPeriodTotal?: number;
    percentChange?: number;
    currency?: string;
    segments?: Array<{ label: string; value: number; percentage: number }>;
    message?: string;
  };
}

export function RevenueCard({ data }: RevenueCardProps) {
  if (data.message && !data.total) {
    return (
      <DataCardMessage
        icon={DollarSign}
        message={data.message}
        title="Revenue note"
        tone="emerald"
      />
    );
  }

  const isPositive = (data.percentChange ?? 0) >= 0;

  // Revenue breakdown
  if (data.segments) {
    return (
      <DataCardFrame
        icon={DollarSign}
        title="Revenue breakdown"
        subtitle="Segment contribution for this period"
        tone="emerald"
      >
        <div className="space-y-3">
          {data.segments.map((seg) => (
            <div key={seg.label} className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium text-foreground">
                  {seg.label}
                </span>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-semibold">
                    {formatCurrency(seg.value, data.currency)}
                  </span>
                  <span className="w-12 text-right text-xs text-muted-foreground">
                    {seg.percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-cyan-300 to-lime-300"
                  style={{ width: `${Math.max(0, Math.min(100, seg.percentage))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </DataCardFrame>
    );
  }

  // Revenue total
  return (
    <DataCardFrame
      icon={DollarSign}
      title="Revenue"
      subtitle="Current period revenue performance"
      tone="emerald"
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <p className="text-3xl font-semibold tracking-tight text-foreground">
            {formatCurrency(data.total ?? 0, data.currency)}
          </p>
          {data.percentChange !== undefined && data.percentChange !== 0 && (
            <span
              className={`mt-2 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                isPositive
                  ? "border-emerald-200/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-200"
                  : "border-rose-200/50 bg-rose-500/10 text-rose-600 dark:text-rose-200"
              }`}
            >
              {isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {formatPercent(data.percentChange)}
            </span>
          )}
        </div>
        {data.previousPeriodTotal !== undefined &&
          data.previousPeriodTotal > 0 && (
            <DataMetricTile
              label="Prior period"
              value={formatCurrency(data.previousPeriodTotal, data.currency)}
              tone="emerald"
            />
          )}
      </div>
    </DataCardFrame>
  );
}
