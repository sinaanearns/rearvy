"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatting";

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
          <Users className="h-4 w-4" />
          Customer Metrics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <p className="text-2xl font-bold">{data.totalCustomers ?? 0}</p>
            <p className="text-xs text-muted-foreground">Customers</p>
          </div>
          <div>
            <p className="text-2xl font-bold">
              {(data.repeatCustomerRate ?? 0).toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground">Repeat rate</p>
          </div>
          <div>
            <p className="text-2xl font-bold">
              {formatCurrency(data.averageOrderValue ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">AOV</p>
          </div>
        </div>

        {data.topCustomers && data.topCustomers.length > 0 && (
          <div className="border-t pt-3 space-y-2">
            <p className="text-xs text-muted-foreground">Top customers</p>
            {data.topCustomers.slice(0, 5).map((customer) => (
              <div
                key={customer.name}
                className="flex items-center justify-between text-sm"
              >
                <span className="truncate max-w-[50%]">{customer.name}</span>
                <div className="flex items-center gap-3">
                  <span className="font-medium">
                    {formatCurrency(customer.totalSpent)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {customer.orderCount} orders
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
