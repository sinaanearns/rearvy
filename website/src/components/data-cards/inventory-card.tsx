"use client";

import { AlertTriangle, CheckCircle2, Warehouse } from "lucide-react";

import { formatCurrency } from "@/lib/utils/formatting";
import { cn } from "@/lib/utils";
import {
  DataCardFrame,
  DataCardMessage,
  DataMetricTile,
} from "./data-card-frame";

interface InventoryCardProps {
  data: {
    products?: Array<{
      title: string;
      quantity: number;
      status: "out_of_stock" | "low_stock" | "in_stock";
      price: number;
      recentRevenue30d?: number;
      unitsSold30d?: number;
    }>;
    lowStockCount?: number;
    outOfStockCount?: number;
    inStockCount?: number;
    prioritization?: string;
    message?: string;
  };
}

const stockBadge: Record<string, { label: string; className: string }> = {
  out_of_stock: {
    label: "Out of stock",
    className: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200",
  },
  low_stock: {
    label: "Low stock",
    className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200",
  },
  in_stock: {
    label: "In stock",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200",
  },
};

export function InventoryCard({ data }: InventoryCardProps) {
  if (data.message && !data.products?.length) {
    return (
      <DataCardMessage
        icon={Warehouse}
        message={data.message}
        title="Inventory note"
        tone="amber"
      />
    );
  }

  return (
    <DataCardFrame
      icon={Warehouse}
      title="Inventory risk"
      subtitle="Stock exposure and priority restocks"
      tone="amber"
    >
      <div className="grid grid-cols-3 gap-3">
        <DataMetricTile
          label="Out"
          value={data.outOfStockCount ?? 0}
          tone="rose"
        />
        <DataMetricTile
          label="Low"
          value={data.lowStockCount ?? 0}
          tone="amber"
        />
        <DataMetricTile
          label="In stock"
          value={data.inStockCount ?? 0}
          tone="emerald"
        />
      </div>

      {data.prioritization ? (
        <div className="flex items-start gap-2 rounded-[8px] border border-amber-200/50 bg-amber-500/10 p-3 text-xs leading-5 text-amber-700 dark:border-amber-900/50 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{data.prioritization}</span>
        </div>
      ) : null}

      {data.message && data.products?.length ? (
        <div className="rounded-[8px] border border-border/70 bg-muted/30 p-3 text-xs leading-5 text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]">
          {data.message}
        </div>
      ) : null}

      <div className="space-y-3">
        {data.products?.slice(0, 10).map((product) => {
          const badge = stockBadge[product.status] || stockBadge.in_stock;

          return (
            <div
              key={product.title}
              className="rounded-[8px] border border-border/70 bg-background/78 p-3 text-sm shadow-sm shadow-slate-950/[0.02] dark:border-white/10 dark:bg-white/[0.04]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">
                    {product.title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {product.recentRevenue30d
                      ? `${formatCurrency(product.recentRevenue30d)} in the last 30 days`
                      : "No recent revenue recorded"}
                    {typeof product.unitsSold30d === "number"
                      ? ` - ${product.unitsSold30d} units sold`
                      : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-[8px] border px-2 py-1 text-xs font-medium",
                    badge.className
                  )}
                >
                  {product.status === "in_stock" ? (
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  )}
                  {badge.label}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/70 pt-3 text-xs text-muted-foreground dark:border-white/10">
                <span>{product.quantity} units available</span>
                <span>{formatCurrency(product.price)} price</span>
              </div>
            </div>
          );
        })}
      </div>
    </DataCardFrame>
  );
}
