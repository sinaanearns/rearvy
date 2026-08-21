import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import { COLLECTIONS } from "@/lib/firebase/schema";

type CustomerOrderRecord = Record<string, unknown> & {
  customer_email?: unknown;
  customer_name?: unknown;
  total_price?: unknown;
};

function toOrderRecord(data: Record<string, unknown>): CustomerOrderRecord {
  return data;
}

function getCustomerKey(order: CustomerOrderRecord): string {
  if (typeof order.customer_email === "string" && order.customer_email.trim()) {
    return order.customer_email;
  }

  if (typeof order.customer_name === "string" && order.customer_name.trim()) {
    return order.customer_name;
  }

  return "Unknown";
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getCustomerMetrics(ctx: ToolContext) {
  return tool({
    description:
      "Get customer metrics: total customers, new customers, average order value, top customers",
    inputSchema: z.object({
      periodStart: z.string().describe("ISO date"),
      periodEnd: z.string().describe("ISO date"),
    }),
    execute: async ({ periodStart, periodEnd }) => {
      const snapshot = await ctx.adminDb
        .collection(COLLECTIONS.ORDERS)
        .where("user_id", "==", ctx.userId)
        .where("placed_at", ">=", periodStart)
        .where("placed_at", "<=", periodEnd)
        .get();
      const orders = snapshot.docs.map((doc) =>
        toOrderRecord(doc.data() as Record<string, unknown>)
      );

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
      const priorSnapshot = await ctx.adminDb
        .collection(COLLECTIONS.ORDERS)
        .where("user_id", "==", ctx.userId)
        .where("placed_at", "<", periodStart)
        .get();
      const priorOrders = priorSnapshot.docs.map((doc) =>
        toOrderRecord(doc.data() as Record<string, unknown>)
      );

      const priorCustomerKeys = new Set(
        priorOrders.map((order) => getCustomerKey(order))
      );

      const customerSpend: Record<
        string,
        { name: string; totalSpent: number; orderCount: number }
      > = {};

      for (const order of orders) {
        const key = getCustomerKey(order);
        if (!customerSpend[key]) {
          customerSpend[key] = {
            name: typeof order.customer_name === "string" && order.customer_name.trim()
              ? order.customer_name
              : key,
            totalSpent: 0,
            orderCount: 0,
          };
        }
        customerSpend[key].totalSpent += toNumber(order.total_price);
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
