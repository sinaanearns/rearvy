"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart } from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatting";

interface OrdersCardProps {
  data: {
    totalOrders?: number;
    totalRevenue?: number;
    averageOrderValue?: number;
    refundedOrderCount?: number;
    refundRate?: number;
    orders?: Array<{
      orderNumber: string;
      totalPrice: number;
      financialStatus: string;
      customerName: string;
      placedAt: string;
    }>;
    orderNumber?: string;
    totalPrice?: number;
    lineItems?: unknown[];
    message?: string;
  };
}

export function OrdersCard({ data }: OrdersCardProps) {
  if (data.message && !data.orders?.length && !data.orderNumber) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground italic">{data.message}</p>
        </CardContent>
      </Card>
    );
  }

  // Single order detail
  if (data.orderNumber) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ShoppingCart className="h-4 w-4" />
            Order #{data.orderNumber}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xl font-bold">
            {formatCurrency(data.totalPrice ?? 0)}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Order summary
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <ShoppingCart className="h-4 w-4" />
          Orders
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-2xl font-bold">{data.totalOrders ?? 0}</p>
            <p className="text-xs text-muted-foreground">Orders</p>
          </div>
          <div>
            <p className="text-2xl font-bold">
              {formatCurrency(data.totalRevenue ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">Revenue</p>
          </div>
          <div>
            <p className="text-2xl font-bold">
              {formatCurrency(data.averageOrderValue ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">AOV</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{data.refundedOrderCount ?? 0}</p>
            <p className="text-xs text-muted-foreground">Refunded</p>
          </div>
          <div>
            <p className="text-2xl font-bold">
              {`${Math.round(data.refundRate ?? 0)}%`}
            </p>
            <p className="text-xs text-muted-foreground">Refund rate</p>
          </div>
        </div>
        <div className="mt-4 border-t pt-3 text-xs text-muted-foreground">
          Rearvy now prioritizes strategic order summaries here. Use a specific
          order number only when you need a customer-support lookup.
        </div>
      </CardContent>
    </Card>
  );
}
