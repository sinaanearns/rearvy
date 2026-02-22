"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpDown, TrendingUp, TrendingDown } from "lucide-react";
import { formatPercent } from "@/lib/utils/formatting";

interface ComparisonCardProps {
  data: {
    periodALabel: string;
    periodBLabel: string;
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
  units_sold: "Units Sold",
  sessions: "Sessions",
  conversion_rate: "Conversion Rate",
  average_order_value: "Avg Order Value",
};

function formatMetricValue(metric: string, value: number): string {
  if (metric === "revenue" || metric === "average_order_value") {
    return `$${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }
  if (metric === "conversion_rate") {
    return `${value.toFixed(1)}%`;
  }
  return value.toLocaleString();
}

export function ComparisonCard({ data }: ComparisonCardProps) {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <ArrowUpDown className="h-4 w-4" />
          Period Comparison
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground mb-2">
          <div>Metric</div>
          <div className="text-right">{data.periodALabel}</div>
          <div className="text-right">{data.periodBLabel}</div>
          <div className="text-right">Change</div>
        </div>
        <div className="space-y-2">
          {data.comparisons.map((comp) => {
            const isPositive = comp.changePercent >= 0;
            return (
              <div
                key={comp.metric}
                className="grid grid-cols-4 gap-2 text-sm items-center"
              >
                <div className="font-medium">
                  {metricLabels[comp.metric] || comp.metric}
                </div>
                <div className="text-right">
                  {formatMetricValue(comp.metric, comp.periodAValue)}
                </div>
                <div className="text-right">
                  {formatMetricValue(comp.metric, comp.periodBValue)}
                </div>
                <div
                  className={`flex items-center justify-end gap-1 text-xs ${
                    isPositive ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {isPositive ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {formatPercent(comp.changePercent)}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
