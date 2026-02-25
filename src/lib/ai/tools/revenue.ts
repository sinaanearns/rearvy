import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";

export function getRevenue(ctx: ToolContext) {
  return tool({
    description:
      "Get total revenue for a time period, optionally broken down by day/week/month",
    inputSchema: z.object({
      periodStart: z.string().describe("ISO date, e.g. 2025-01-01"),
      periodEnd: z.string().describe("ISO date, e.g. 2025-01-31"),
      granularity: z
        .enum(["daily", "weekly", "monthly"])
        .optional()
        .default("daily"),
    }),
    execute: async ({ periodStart, periodEnd, granularity }) => {
      const { data } = await ctx.supabase
        .from("business_metrics")
        .select("metric_value, period_start")
        .eq("user_id", ctx.userId)
        .eq("metric_type", "revenue")
        .eq("granularity", granularity)
        .gte("period_start", periodStart)
        .lte("period_end", periodEnd)
        .order("period_start", { ascending: true });

      if (!data || data.length === 0) {
        return {
          total: 0,
          previousPeriodTotal: 0,
          percentChange: 0,
          currency: "USD",
          dataPoints: [],
          message:
            "No revenue data found. Connect your Shopify store to start tracking revenue.",
        };
      }

      const total = data.reduce(
        (sum, d) => sum + Number(d.metric_value),
        0
      );
      const dataPoints = data.map((d) => ({
        date: d.period_start,
        value: Number(d.metric_value),
      }));

      return {
        total,
        previousPeriodTotal: 0,
        percentChange: 0,
        currency: "USD",
        dataPoints,
      };
    },
  });
}

export function getRevenueBreakdown(ctx: ToolContext) {
  return tool({
    description:
      "Break down revenue by product, channel, day of week, or hour of day",
    inputSchema: z.object({
      periodStart: z.string().describe("ISO date"),
      periodEnd: z.string().describe("ISO date"),
      breakdownBy: z.enum(["product", "channel", "day_of_week"]),
      limit: z.number().optional().default(10),
    }),
    execute: async ({ periodStart, periodEnd, breakdownBy, limit }) => {
      if (breakdownBy === "product") {
        const { data } = await ctx.supabase
          .from("orders")
          .select("line_items, total_price")
          .eq("user_id", ctx.userId)
          .gte("placed_at", periodStart)
          .lte("placed_at", periodEnd);

        if (!data || data.length === 0) {
          return {
            segments: [],
            total: 0,
            message: "No order data found for this period.",
          };
        }

        const productRevenue: Record<string, number> = {};
        let total = 0;
        for (const order of data) {
          const items = order.line_items as Array<{
            title: string;
            price: number;
            quantity: number;
          }>;
          if (Array.isArray(items)) {
            for (const item of items) {
              const rev = (item.price || 0) * (item.quantity || 1);
              productRevenue[item.title] =
                (productRevenue[item.title] || 0) + rev;
              total += rev;
            }
          }
        }

        const segments = Object.entries(productRevenue)
          .sort(([, a], [, b]) => b - a)
          .slice(0, limit)
          .map(([label, value]) => ({
            label,
            value,
            percentage: total > 0 ? (value / total) * 100 : 0,
          }));

        return { segments, total };
      }

      if (breakdownBy === "day_of_week") {
        const { data } = await ctx.supabase
          .from("orders")
          .select("total_price, placed_at")
          .eq("user_id", ctx.userId)
          .gte("placed_at", periodStart)
          .lte("placed_at", periodEnd);

        if (!data || data.length === 0) {
          return {
            segments: [],
            total: 0,
            message: "No order data found for this period.",
          };
        }

        const dayNames = [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ];
        const dayRevenue: Record<string, number> = {};
        let total = 0;

        for (const order of data) {
          const dayIndex = new Date(order.placed_at).getDay();
          const dayName = dayNames[dayIndex];
          dayRevenue[dayName] = (dayRevenue[dayName] || 0) + Number(order.total_price);
          total += Number(order.total_price);
        }

        const segments = dayNames
          .filter((day) => dayRevenue[day])
          .map((day) => ({
            label: day,
            value: dayRevenue[day],
            percentage: total > 0 ? (dayRevenue[day] / total) * 100 : 0,
          }))
          .sort((a, b) => b.value - a.value);

        return { segments, total };
      }

      return {
        segments: [],
        total: 0,
        message: `Breakdown by ${breakdownBy} is not yet available.`,
      };
    },
  });
}
