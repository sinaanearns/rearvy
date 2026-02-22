import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";

export function getRecentInsights(ctx: ToolContext) {
  return tool({
    description:
      "Get recent AI-detected business insights, anomalies, and trends",
    inputSchema: z.object({
      limit: z.number().optional().default(5),
      type: z
        .enum([
          "all",
          "anomaly",
          "trend",
          "milestone",
          "opportunity",
          "risk",
        ])
        .optional()
        .default("all"),
      unreadOnly: z.boolean().optional().default(false),
    }),
    execute: async ({ limit, type, unreadOnly }) => {
      let query = ctx.supabase
        .from("insights")
        .select("*")
        .eq("user_id", ctx.userId)
        .eq("is_dismissed", false)
        .order("generated_at", { ascending: false })
        .limit(limit);

      if (type !== "all") {
        query = query.eq("insight_type", type);
      }
      if (unreadOnly) {
        query = query.eq("is_read", false);
      }

      const { data } = await query;

      return {
        insights: (data || []).map((i) => ({
          id: i.id,
          type: i.insight_type,
          severity: i.severity,
          title: i.title,
          summary: i.summary,
          dataSnapshot: i.data_snapshot,
          generatedAt: i.generated_at,
        })),
      };
    },
  });
}
