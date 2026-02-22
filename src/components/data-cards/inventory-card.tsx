"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Warehouse } from "lucide-react";

interface InventoryCardProps {
  data: {
    products?: Array<{
      title: string;
      quantity: number;
      status: "out_of_stock" | "low_stock" | "in_stock";
      price: number;
    }>;
    lowStockCount?: number;
    outOfStockCount?: number;
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
          Inventory Status
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

        <div className="space-y-2">
          {data.products?.slice(0, 10).map((product) => {
            const badge = stockBadge[product.status];
            return (
              <div
                key={product.title}
                className="flex items-center justify-between text-sm"
              >
                <span className="truncate max-w-[50%]">{product.title}</span>
                <div className="flex items-center gap-2">
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
