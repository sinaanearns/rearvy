import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import { COLLECTIONS } from "@/lib/firebase/schema";

function readMetricValue(row: Record<string, unknown>): number {
  const value = row.metric_value ?? row.value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safePercentChange(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  const percent = ((current - previous) / previous) * 100;
  return Number.isFinite(percent) ? percent : 0;
}

async function getMetricSum(
  ctx: ToolContext,
  metric: string,
  start: string,
  end: string
): Promise<number> {
  const snapshot = await ctx.adminDb
    .collection(COLLECTIONS.BUSINESS_METRICS)
    .where("user_id", "==", ctx.userId)
    .where("metric_type", "==", metric)
    .where("period_start", ">=", start)
    .where("period_end", "<=", end)
    .get();

  const rows = snapshot.docs.map((doc) => doc.data() as Record<string, unknown>);
  return rows.reduce((sum, row) => sum + readMetricValue(row), 0);
}

async function resolveComparisonCurrency(
  ctx: ToolContext,
  start: string,
  end: string
): Promise<string> {
  const snapshot = await ctx.adminDb
    .collection(COLLECTIONS.ORDERS)
    .where("user_id", "==", ctx.userId)
    .where("placed_at", ">=", start)
    .where("placed_at", "<=", end)
    .limit(100)
    .get();

  const counts = new Map<string, number>();
  for (const doc of snapshot.docs) {
    const row = doc.data() as Record<string, unknown>;
    const raw = row.currency;
    if (typeof raw !== "string" || !raw.trim()) continue;
    const code = raw.trim().toUpperCase();
    counts.set(code, (counts.get(code) || 0) + 1);
  }

  let best: string | null = null;
  let highest = 0;
  for (const [code, count] of counts) {
    if (count > highest) {
      best = code;
      highest = count;
    }
  }

  return best || "USD";
}

export function comparePerformance(ctx: ToolContext) {
  return tool({
    description:
      "Compare business metrics across two time periods (e.g. this month vs last month)",
    inputSchema: z.object({
      periodA: z.object({
        start: z.string(),
        end: z.string(),
        label: z.string().optional(),
      }),
      periodB: z.object({
        start: z.string(),
        end: z.string(),
        label: z.string().optional(),
      }),
      metrics: z.array(
        z.enum([
          "revenue",
          "orders",
          "units_sold",
          "sessions",
          "conversion_rate",
          "average_order_value",
        ])
      ),
    }),
    execute: async ({ periodA, periodB, metrics }) => {
      const comparisons = [];
      const warnings: string[] = [];
      const currency = await resolveComparisonCurrency(
        ctx,
        periodA.start,
        periodA.end
      );

      for (const metric of metrics) {
        let sumA = 0;
        let sumB = 0;

        if (metric === "conversion_rate") {
          const [ordersA, sessionsA, ordersB, sessionsB] = await Promise.all([
            getMetricSum(ctx, "orders", periodA.start, periodA.end),
            getMetricSum(ctx, "sessions", periodA.start, periodA.end),
            getMetricSum(ctx, "orders", periodB.start, periodB.end),
            getMetricSum(ctx, "sessions", periodB.start, periodB.end),
          ]);

          if (sessionsA === 0 && ordersA > 0) {
            warnings.push(
              `Conversion rate for ${periodA.label || "period A"} had zero sessions with non-zero orders; returning 0 to avoid inflated percentages.`
            );
          }

          if (sessionsB === 0 && ordersB > 0) {
            warnings.push(
              `Conversion rate for ${periodB.label || "period B"} had zero sessions with non-zero orders; returning 0 to avoid inflated percentages.`
            );
          }

          sumA = sessionsA > 0 ? (ordersA / sessionsA) * 100 : 0;
          sumB = sessionsB > 0 ? (ordersB / sessionsB) * 100 : 0;
        } else {
          const [metricA, metricB] = await Promise.all([
            getMetricSum(ctx, metric, periodA.start, periodA.end),
            getMetricSum(ctx, metric, periodB.start, periodB.end),
          ]);

          sumA = metricA;
          sumB = metricB;
        }

        const change = sumA - sumB;
        const changePercent = safePercentChange(sumA, sumB);

        comparisons.push({
          metric,
          periodAValue: sumA,
          periodBValue: sumB,
          change,
          changePercent,
        });
      }

      return {
        periodALabel: periodA.label || `${periodA.start} to ${periodA.end}`,
        periodBLabel: periodB.label || `${periodB.start} to ${periodB.end}`,
        currency,
        comparisons,
        warnings,
      };
    },
  });
}
