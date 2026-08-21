"use client";

import { Crown, Users } from "lucide-react";

import { formatCurrency } from "@/lib/utils/formatting";
import {
  DataCardFrame,
  DataCardMessage,
  DataMetricTile,
} from "./data-card-frame";

interface CustomerCardProps {
  data: {
    totalCustomers?: number;
    newCustomers?: number;
    repeatCustomerRate?: number;
    averageOrderValue?: number;
    topCustomers?: Array<{
      name: string;
      totalSpent: number;
      orderCount: number;
    }>;
    message?: string;
  };
}

export function CustomerCard({ data }: CustomerCardProps) {
  if (data.message && !data.totalCustomers) {
    return (
      <DataCardMessage
        icon={Users}
        message={data.message}
        title="Customer note"
        tone="violet"
      />
    );
  }

  return (
    <DataCardFrame
      icon={Users}
      title="Customer metrics"
      subtitle="Customer base, retention, and high-value buyers"
      tone="violet"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <DataMetricTile
          label="Customers"
          value={data.totalCustomers ?? 0}
          tone="violet"
        />
        <DataMetricTile
          label="New"
          value={data.newCustomers ?? 0}
          tone="violet"
        />
        <DataMetricTile
          label="Repeat rate"
          value={`${(data.repeatCustomerRate ?? 0).toFixed(1)}%`}
          tone="violet"
        />
        <DataMetricTile
          label="AOV"
          value={formatCurrency(data.averageOrderValue ?? 0)}
          tone="violet"
        />
      </div>

      {data.topCustomers && data.topCustomers.length > 0 && (
        <div className="space-y-3 border-t border-border/70 pt-4 dark:border-white/10">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Crown className="h-3.5 w-3.5 text-violet-500" aria-hidden="true" />
            Top customers
          </div>
          {data.topCustomers.slice(0, 5).map((customer, index) => (
            <div
              key={customer.name}
              className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 rounded-[8px] border border-border/70 bg-background/78 p-3 text-sm shadow-sm shadow-slate-950/[0.02] dark:border-white/10 dark:bg-white/[0.04]"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-violet-200/30 bg-violet-200/10 text-xs font-semibold text-violet-700 dark:text-violet-200">
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold text-foreground">
                  {customer.name}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {customer.orderCount} orders
                </span>
              </span>
              <span className="shrink-0 font-semibold">
                {formatCurrency(customer.totalSpent)}
              </span>
            </div>
          ))}
        </div>
      )}
    </DataCardFrame>
  );
}
