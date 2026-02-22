import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";

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

      for (const metric of metrics) {
        const [resultA, resultB] = await Promise.all([
          ctx.supabase
            .from("business_metrics")
            .select("metric_value")
            .eq("user_id", ctx.userId)
            .eq("metric_type", metric)
            .gte("period_start", periodA.start)
            .lte("period_end", periodA.end),
          ctx.supabase
            .from("business_metrics")
            .select("metric_value")
            .eq("user_id", ctx.userId)
            .eq("metric_type", metric)
            .gte("period_start", periodB.start)
            .lte("period_end", periodB.end),
        ]);

        const sumA = (resultA.data || []).reduce(
          (s, d) => s + Number(d.metric_value),
          0
        );
        const sumB = (resultB.data || []).reduce(
          (s, d) => s + Number(d.metric_value),
          0
        );
        const change = sumA - sumB;
        const changePercent = sumB !== 0 ? (change / sumB) * 100 : 0;

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
        comparisons,
      };
    },
  });
}
