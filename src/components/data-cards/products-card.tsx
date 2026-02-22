"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatting";

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
      <Card className="w-full max-w-md">
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground italic">{data.message}</p>
        </CardContent>
      </Card>
    );
  }

  // Single product detail
  if (data.title && !data.products) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Package className="h-4 w-4" />
            Product Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-semibold">{data.title}</p>
          <dl className="mt-2 space-y-1 text-sm">
            {data.price != null && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Price</dt>
                <dd className="font-medium">{formatCurrency(data.price)}</dd>
              </div>
            )}
            {data.inventoryQuantity != null && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">In stock</dt>
                <dd className="font-medium">{data.inventoryQuantity} units</dd>
              </div>
            )}
            {data.status && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-medium capitalize">{data.status}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>
    );
  }

  // Product list
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Package className="h-4 w-4" />
          Top Products
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.products?.map((product, i) => (
            <div
              key={product.title}
              className="flex items-center justify-between text-sm"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-muted-foreground w-4">
                  {i + 1}.
                </span>
                <span className="truncate">{product.title}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {product.revenue != null && (
                  <span className="font-medium">
                    {formatCurrency(product.revenue)}
                  </span>
                )}
                {product.unitsSold != null && (
                  <span className="text-xs text-muted-foreground">
                    {product.unitsSold} sold
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
