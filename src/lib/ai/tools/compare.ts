import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import { COLLECTIONS } from "@/lib/firebase/schema";

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
        const [snapA, snapB] = await Promise.all([
          ctx.adminDb
            .collection(COLLECTIONS.BUSINESS_METRICS)
            .where("user_id", "==", ctx.userId)
            .where("metric_type", "==", metric)
            .where("period_start", ">=", periodA.start)
            .where("period_end", "<=", periodA.end)
            .get(),
          ctx.adminDb
            .collection(COLLECTIONS.BUSINESS_METRICS)
            .where("user_id", "==", ctx.userId)
            .where("metric_type", "==", metric)
            .where("period_start", ">=", periodB.start)
            .where("period_end", "<=", periodB.end)
            .get(),
        ]);
        const resultA = snapA.docs.map((doc) => doc.data() as any);
        const resultB = snapB.docs.map((doc) => doc.data() as any);

        const sumA = resultA.reduce(
          (s, d) => s + Number(d.metric_value),
          0
        );
        const sumB = resultB.reduce(
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
