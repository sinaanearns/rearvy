"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart } from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatting";

interface OrdersCardProps {
  data: {
    totalOrders?: number;
    totalRevenue?: number;
    averageOrderValue?: number;
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

const statusColors: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  refunded: "bg-red-100 text-red-700",
  fulfilled: "bg-blue-100 text-blue-700",
  unfulfilled: "bg-gray-100 text-gray-700",
};

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
        <div className="grid grid-cols-3 gap-4 mb-4">
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
        </div>

        {data.orders && data.orders.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            {data.orders.slice(0, 5).map((order) => (
              <div
                key={order.orderNumber}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">#{order.orderNumber}</span>
                  <Badge
                    variant="secondary"
                    className={`text-xs ${
                      statusColors[order.financialStatus] || ""
                    }`}
                  >
                    {order.financialStatus}
                  </Badge>
                </div>
                <span className="font-medium">
                  {formatCurrency(order.totalPrice)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
