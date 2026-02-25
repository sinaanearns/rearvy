import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";

export function getCustomerMetrics(ctx: ToolContext) {
  return tool({
    description:
      "Get customer metrics: total customers, new customers, average order value, top customers",
    inputSchema: z.object({
      periodStart: z.string().describe("ISO date"),
      periodEnd: z.string().describe("ISO date"),
    }),
    execute: async ({ periodStart, periodEnd }) => {
      const { data: orders } = await ctx.supabase
        .from("orders")
        .select("customer_email, customer_name, total_price")
        .eq("user_id", ctx.userId)
        .gte("placed_at", periodStart)
        .lte("placed_at", periodEnd);

      if (!orders || orders.length === 0) {
        return {
          totalCustomers: 0,
          newCustomers: 0,
          returningCustomers: 0,
          repeatCustomerRate: 0,
          averageOrderValue: 0,
          estimatedLifetimeValue: 0,
          topCustomers: [],
          message: "No customer data found for this period.",
        };
      }

      // Get all orders before this period to identify new vs returning
      const { data: priorOrders } = await ctx.supabase
        .from("orders")
        .select("customer_email, customer_name")
        .eq("user_id", ctx.userId)
        .lt("placed_at", periodStart);

      const priorCustomerKeys = new Set(
        (priorOrders || []).map(
          (o) => o.customer_email || o.customer_name || "Unknown"
        )
      );

      const customerSpend: Record<
        string,
        { name: string; totalSpent: number; orderCount: number }
      > = {};

      for (const order of orders) {
        const key = order.customer_email || order.customer_name || "Unknown";
        if (!customerSpend[key]) {
          customerSpend[key] = {
            name: order.customer_name || key,
            totalSpent: 0,
            orderCount: 0,
          };
        }
        customerSpend[key].totalSpent += Number(order.total_price);
        customerSpend[key].orderCount += 1;
      }

      const customers = Object.entries(customerSpend);
      const totalRevenue = customers.reduce(
        (s, [, c]) => s + c.totalSpent,
        0
      );
      const repeatCustomers = customers.filter(
        ([, c]) => c.orderCount > 1
      ).length;

      const newCustomers = customers.filter(
        ([key]) => !priorCustomerKeys.has(key)
      ).length;
      const returningCustomers = customers.length - newCustomers;

      return {
        totalCustomers: customers.length,
        newCustomers,
        returningCustomers,
        repeatCustomerRate:
          customers.length > 0
            ? (repeatCustomers / customers.length) * 100
            : 0,
        averageOrderValue:
          orders.length > 0 ? totalRevenue / orders.length : 0,
        estimatedLifetimeValue:
          customers.length > 0 ? totalRevenue / customers.length : 0,
        topCustomers: customers
          .map(([, c]) => c)
          .sort((a, b) => b.totalSpent - a.totalSpent)
          .slice(0, 5),
      };
    },
  });
}
