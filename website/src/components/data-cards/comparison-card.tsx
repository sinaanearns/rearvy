"use client";

import { AlertTriangle, ArrowUpDown, TrendingDown, TrendingUp } from "lucide-react";

import { formatCurrency, formatPercent } from "@/lib/utils/formatting";
import { DataCardFrame } from "./data-card-frame";

interface ComparisonCardProps {
  data: {
    periodALabel: string;
    periodBLabel: string;
    currency?: string;
    warnings?: string[];
    comparisons: Array<{
      metric: string;
      periodAValue: number;
      periodBValue: number;
      change: number;
      changePercent: number;
    }>;
  };
}

const metricLabels: Record<string, string> = {
  revenue: "Revenue",
  orders: "Orders",
  units_sold: "Units sold",
  sessions: "Sessions",
  conversion_rate: "Conversion rate",
  average_order_value: "Avg order value",
};

function formatMetricValue(metric: string, value: number, currency: string): string {
  if (metric === "revenue" || metric === "average_order_value") {
    return formatCurrency(value, currency);
  }
  if (metric === "conversion_rate") {
    return `${value.toFixed(1)}%`;
  }
  return value.toLocaleString();
}

export function ComparisonCard({ data }: ComparisonCardProps) {
  const currency = data.currency || "USD";

  return (
    <DataCardFrame
      icon={ArrowUpDown}
      title="Period comparison"
      subtitle={`${data.periodALabel} vs ${data.periodBLabel}`}
      tone="cyan"
      className="max-w-2xl"
    >
      <div className="overflow-hidden rounded-[8px] border border-border/70 dark:border-white/10">
        <div className="grid grid-cols-[1fr_0.8fr_0.8fr_0.7fr] gap-2 bg-muted/40 px-3 py-2 text-[11px] font-medium text-muted-foreground">
          <div>Metric</div>
          <div className="text-right">{data.periodALabel}</div>
          <div className="text-right">{data.periodBLabel}</div>
          <div className="text-right">Change</div>
        </div>
        <div className="divide-y divide-border/70 dark:divide-white/10">
          {data.comparisons.map((comp) => {
            const isPositive = comp.changePercent >= 0;

            return (
              <div
                key={comp.metric}
                className="grid grid-cols-[1fr_0.8fr_0.8fr_0.7fr] items-center gap-2 px-3 py-3 text-sm"
              >
                <div className="font-semibold text-foreground">
                  {metricLabels[comp.metric] || comp.metric}
                </div>
                <div className="text-right text-muted-foreground">
                  {formatMetricValue(comp.metric, comp.periodAValue, currency)}
                </div>
                <div className="text-right text-muted-foreground">
                  {formatMetricValue(comp.metric, comp.periodBValue, currency)}
                </div>
                <div
                  className={`flex items-center justify-end gap-1 text-xs font-semibold ${
                    isPositive ? "text-emerald-600 dark:text-emerald-200" : "text-rose-600 dark:text-rose-200"
                  }`}
                >
                  {isPositive ? (
                    <TrendingUp className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <TrendingDown className="h-3 w-3" aria-hidden="true" />
                  )}
                  {formatPercent(comp.changePercent)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {Array.isArray(data.warnings) && data.warnings.length > 0 && (
        <div className="flex items-start gap-2 rounded-[8px] border border-amber-200/50 bg-amber-500/10 p-3 text-xs leading-5 text-amber-700 dark:border-amber-900/50 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{data.warnings[0]}</span>
        </div>
      )}
    </DataCardFrame>
  );
}
