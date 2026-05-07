"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/utils/formatting";

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
      <Card className="w-full max-w-md">
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground italic">{data.message}</p>
        </CardContent>
      </Card>
    );
  }

  const isPositive = (data.percentChange ?? 0) >= 0;

  // Revenue breakdown
  if (data.segments) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            Revenue Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.segments.map((seg) => (
              <div key={seg.label} className="flex items-center justify-between text-sm">
                <span className="truncate max-w-[60%]">{seg.label}</span>
                <div className="flex items-center gap-3">
                  <span className="font-medium">
                    {formatCurrency(seg.value, data.currency)}
                  </span>
                  <span className="text-xs text-muted-foreground w-12 text-right">
                    {seg.percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Revenue total
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <DollarSign className="h-4 w-4" />
          Revenue
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-bold">
            {formatCurrency(data.total ?? 0, data.currency)}
          </span>
          {data.percentChange !== undefined && data.percentChange !== 0 && (
            <span
              className={`flex items-center gap-1 text-sm ${
                isPositive ? "text-green-600" : "text-red-600"
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
            <p className="mt-1 text-xs text-muted-foreground">
              vs {formatCurrency(data.previousPeriodTotal, data.currency)} prior
              period
            </p>
          )}
      </CardContent>
    </Card>
  );
}
