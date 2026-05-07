"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Warehouse } from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatting";

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
    className: "bg-red-100 text-red-700",
  },
  low_stock: {
    label: "Low stock",
    className: "bg-yellow-100 text-yellow-700",
  },
  in_stock: {
    label: "In stock",
    className: "bg-green-100 text-green-700",
  },
};

export function InventoryCard({ data }: InventoryCardProps) {
  if (data.message && !data.products?.length) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground italic">{data.message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Warehouse className="h-4 w-4" />
          Inventory Risk
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-4">
          <div>
            <span className="text-lg font-bold text-red-600">
              {data.outOfStockCount ?? 0}
            </span>
            <span className="ml-1 text-xs text-muted-foreground">
              out of stock
            </span>
          </div>
          <div>
            <span className="text-lg font-bold text-yellow-600">
              {data.lowStockCount ?? 0}
            </span>
            <span className="ml-1 text-xs text-muted-foreground">
              low stock
            </span>
          </div>
        </div>

        {data.prioritization ? (
          <p className="mb-3 text-xs text-muted-foreground">
            {data.prioritization}
          </p>
        ) : null}

        {data.message && data.products?.length ? (
          <p className="mb-3 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {data.message}
          </p>
        ) : null}

        <div className="space-y-2">
          {data.products?.slice(0, 10).map((product) => {
            const badge = stockBadge[product.status];
            return (
              <div
                key={product.title}
                className="flex items-start justify-between gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{product.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {product.recentRevenue30d
                      ? `${formatCurrency(product.recentRevenue30d)} in the last 30 days`
                      : "No recent revenue recorded"}
                    {typeof product.unitsSold30d === "number"
                      ? ` • ${product.unitsSold30d} units sold`
                      : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-medium">{product.quantity} units</span>
                  <Badge variant="secondary" className={`text-xs ${badge.className}`}>
                    {badge.label}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
