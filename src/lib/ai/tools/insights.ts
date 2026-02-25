import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import { isMissingTableError } from "@/lib/integrations/schema-health";

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

      const { data, error } = await query;

      if (error) {
        if (isMissingTableError(error)) {
          return {
            ok: false,
            errorCode: "INSIGHTS_TABLE_MISSING",
            message:
              "The insights table is missing in the database, so recent insights are unavailable.",
            action:
              "Run Supabase migrations, then sync integrations again.",
            insights: [],
          };
        }

        return {
          ok: false,
          errorCode: "INSIGHTS_QUERY_FAILED",
          message: "Failed to load recent insights.",
          action: "Try again after your next sync.",
          insights: [],
        };
      }

      return {
        ok: true,
        message:
          data && data.length > 0
            ? "Recent insights loaded."
            : "No recent insights found yet.",
        action:
          !data || data.length === 0
            ? "Use raw data tools (YouTube/Shopify metrics) or run a fresh sync."
            : undefined,
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
