"use client";

import { Package } from "lucide-react";

import { formatCurrency } from "@/lib/utils/formatting";
import {
  DataCardFrame,
  DataCardMessage,
  DataMetricTile,
} from "./data-card-frame";

interface ProductsCardProps {
  data: {
    products?: Array<{
      title: string;
      revenue?: number;
      unitsSold?: number;
      percentOfTotal?: number;
      price?: number;
      inventoryQuantity?: number;
      status?: string;
    }>;
    title?: string;
    price?: number;
    inventoryQuantity?: number;
    status?: string;
    message?: string;
  };
}

export function ProductsCard({ data }: ProductsCardProps) {
  if (data.message && !data.products?.length && !data.title) {
    return (
      <DataCardMessage
        icon={Package}
        message={data.message}
        title="Product note"
        tone="amber"
      />
    );
  }

  if (data.title && !data.products) {
    return (
      <DataCardFrame
        icon={Package}
        title="Product details"
        subtitle={data.title}
        tone="amber"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {data.price != null && (
            <DataMetricTile
              label="Price"
              value={formatCurrency(data.price)}
              tone="amber"
            />
          )}
          {data.inventoryQuantity != null && (
            <DataMetricTile
              label="In stock"
              value={`${data.inventoryQuantity} units`}
              tone="amber"
            />
          )}
          {data.status && (
            <DataMetricTile
              label="Status"
              value={<span className="capitalize">{data.status}</span>}
              tone="amber"
            />
          )}
        </div>
      </DataCardFrame>
    );
  }

  return (
    <DataCardFrame
      icon={Package}
      title="Top products"
      subtitle="Ranked by available product performance"
      tone="amber"
    >
      <div className="space-y-3">
        {(data.products || []).map((product, index) => {
          const share = product.percentOfTotal ?? 0;

          return (
            <div
              key={product.title}
              className="rounded-[8px] border border-border/70 bg-background/78 p-3 shadow-sm shadow-slate-950/[0.02] dark:border-white/10 dark:bg-white/[0.04]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-amber-200/40 bg-amber-200/10 text-xs font-semibold text-amber-700 dark:text-amber-200">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {product.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {product.unitsSold != null ? `${product.unitsSold} sold` : "Product signal"}
                    </p>
                  </div>
                </div>
                {product.revenue != null && (
                  <span className="shrink-0 text-sm font-semibold">
                    {formatCurrency(product.revenue)}
                  </span>
                )}
              </div>
              {product.percentOfTotal != null && (
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-300 via-orange-300 to-rose-300"
                    style={{ width: `${Math.max(0, Math.min(100, share))}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </DataCardFrame>
  );
}
