import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import { COLLECTIONS } from "@/lib/firebase/schema";

function readMetricValue(row: Record<string, unknown>): number {
  const value = row.metric_value ?? row.value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pickMostCommonCurrency(rows: Array<Record<string, unknown>>): string | null {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const raw = row.currency;
    if (typeof raw !== "string" || !raw.trim()) continue;
    const code = raw.trim().toUpperCase();
    counts.set(code, (counts.get(code) || 0) + 1);
  }

  let winner: string | null = null;
  let highest = 0;
  for (const [code, count] of counts) {
    if (count > highest) {
      winner = code;
      highest = count;
    }
  }

  return winner;
}

async function resolveRevenueCurrency(
  ctx: ToolContext,
  periodStart: string,
  periodEnd: string
): Promise<string> {
  const ordersSnapshot = await ctx.adminDb
    .collection(COLLECTIONS.ORDERS)
    .where("user_id", "==", ctx.userId)
    .where("placed_at", ">=", periodStart)
    .where("placed_at", "<=", periodEnd)
    .limit(200)
    .get();

  const orders = ordersSnapshot.docs.map((doc) => doc.data() as Record<string, unknown>);
  const orderCurrency = pickMostCommonCurrency(orders);
  if (orderCurrency) return orderCurrency;

  const profileSnapshot = await ctx.adminDb
    .collection(COLLECTIONS.PROFILES)
    .doc(ctx.userId)
    .get();

  const profileCurrency = profileSnapshot.data()?.currency;
  if (typeof profileCurrency === "string" && profileCurrency.trim()) {
    return profileCurrency.trim().toUpperCase();
  }

  return "USD";
}

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
      const [snapshot, currency] = await Promise.all([
        ctx.adminDb
          .collection(COLLECTIONS.BUSINESS_METRICS)
          .where("user_id", "==", ctx.userId)
          .where("metric_type", "==", "revenue")
          .where("granularity", "==", granularity)
          .where("period_start", ">=", periodStart)
          .where("period_end", "<=", periodEnd)
          .orderBy("period_start", "asc")
          .get(),
        resolveRevenueCurrency(ctx, periodStart, periodEnd),
      ]);
      const data = snapshot.docs.map((doc) => doc.data() as Record<string, unknown>);

      if (!data || data.length === 0) {
        const integrationSnapshot = await ctx.adminDb
          .collection(COLLECTIONS.INTEGRATIONS)
          .where("user_id", "==", ctx.userId)
          .where("provider", "==", "shopify")
          .where("status", "==", "active")
          .limit(1)
          .get();

        const pendingMessage = !integrationSnapshot.empty
          ? "Shopify data sync is in progress. Revenue charts will appear once the initial backfill finishes."
          : "No revenue data found. Connect your Shopify store to start tracking revenue.";

        return {
          total: 0,
          previousPeriodTotal: 0,
          percentChange: 0,
          currency,
          dataPoints: [],
          status: !integrationSnapshot.empty ? "syncing" : "empty",
          message: pendingMessage,
        };
      }

      const total = data.reduce(
        (sum, d) => sum + readMetricValue(d),
        0
      );
      const dataPoints = data.map((d) => ({
        date: String(d.period_start || ""),
        value: readMetricValue(d),
      }));

      return {
        total,
        previousPeriodTotal: 0,
        percentChange: 0,
        currency,
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
      const currency = await resolveRevenueCurrency(ctx, periodStart, periodEnd);

      if (breakdownBy === "product") {
        const snapshot = await ctx.adminDb
          .collection(COLLECTIONS.ORDERS)
          .where("user_id", "==", ctx.userId)
          .where("placed_at", ">=", periodStart)
          .where("placed_at", "<=", periodEnd)
          .get();
        const data = snapshot.docs.map((doc) => doc.data() as any);

        if (!data || data.length === 0) {
          return {
            segments: [],
            total: 0,
            currency,
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

        return { segments, total, currency };
      }

      if (breakdownBy === "day_of_week") {
        const snapshot = await ctx.adminDb
          .collection(COLLECTIONS.ORDERS)
          .where("user_id", "==", ctx.userId)
          .where("placed_at", ">=", periodStart)
          .where("placed_at", "<=", periodEnd)
          .get();
        const data = snapshot.docs.map((doc) => doc.data() as any);

        if (!data || data.length === 0) {
          return {
            segments: [],
            total: 0,
            currency,
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

        return { segments, total, currency };
      }

      return {
        segments: [],
        total: 0,
        currency,
        message: `Breakdown by ${breakdownBy} is not yet available.`,
      };
    },
  });
}
