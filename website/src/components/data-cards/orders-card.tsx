"use client";

import { ShoppingCart } from "lucide-react";

import { formatCurrency } from "@/lib/utils/formatting";
import {
  DataCardFrame,
  DataCardMessage,
  DataMetricTile,
} from "./data-card-frame";

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
      <DataCardMessage
        icon={ShoppingCart}
        message={data.message}
        title="Order note"
        tone="cyan"
      />
    );
  }

  if (data.orderNumber) {
    return (
      <DataCardFrame
        icon={ShoppingCart}
        title={`Order #${data.orderNumber}`}
        subtitle="Customer-support order lookup"
        tone="cyan"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <DataMetricTile
            label="Order value"
            value={formatCurrency(data.totalPrice ?? 0)}
            tone="cyan"
          />
          <DataMetricTile
            label="Line items"
            value={data.lineItems?.length ?? 0}
            tone="cyan"
          />
        </div>
      </DataCardFrame>
    );
  }

  return (
    <DataCardFrame
      icon={ShoppingCart}
      title="Orders"
      subtitle="Commerce performance summary"
      tone="cyan"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <DataMetricTile label="Orders" value={data.totalOrders ?? 0} tone="cyan" />
        <DataMetricTile
          label="Revenue"
          value={formatCurrency(data.totalRevenue ?? 0)}
          tone="cyan"
        />
        <DataMetricTile
          label="AOV"
          value={formatCurrency(data.averageOrderValue ?? 0)}
          tone="cyan"
        />
        <DataMetricTile
          label="Refunded"
          value={data.refundedOrderCount ?? 0}
          tone="cyan"
        />
        <DataMetricTile
          label="Refund rate"
          value={`${Math.round(data.refundRate ?? 0)}%`}
          tone="cyan"
        />
      </div>
      <div className="rounded-[8px] border border-border/70 bg-muted/30 p-3 text-xs leading-5 text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]">
        Rearvy prioritizes strategic order summaries here. Use a specific order
        number only when you need a customer-support lookup.
      </div>
    </DataCardFrame>
  );
}
