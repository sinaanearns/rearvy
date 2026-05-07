import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import { COLLECTIONS } from "@/lib/firebase/schema";

type StoredInsight = {
  insight_type?: string;
  severity?: string;
  title?: string;
  summary?: string;
  data_snapshot?: Record<string, unknown>;
  generated_at?: string;
  is_dismissed?: boolean;
  is_read?: boolean;
};

function normalizeInsights(
  docs: Array<{ id: string; data: () => StoredInsight }>,
  {
    limit,
    type,
    unreadOnly,
  }: {
    limit: number;
    type: "all" | "anomaly" | "trend" | "milestone" | "opportunity" | "risk";
    unreadOnly: boolean;
  }
) {
  return docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((insight) => insight.is_dismissed !== true)
    .filter((insight) => (type === "all" ? true : insight.insight_type === type))
    .filter((insight) => (unreadOnly ? insight.is_read === false : true))
    .sort((left, right) => {
      const leftTime = left.generated_at ? new Date(left.generated_at).getTime() : 0;
      const rightTime = right.generated_at ? new Date(right.generated_at).getTime() : 0;
      return rightTime - leftTime;
    })
    .slice(0, limit)
    .map((insight) => ({
      id: insight.id,
      type: insight.insight_type,
      severity: insight.severity,
      title: insight.title,
      summary: insight.summary,
      dataSnapshot: insight.data_snapshot,
      generatedAt: insight.generated_at,
    }));
}

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
      const normalizedLimit = Math.max(1, Math.min(limit, 25));

      try {
        let query = ctx.adminDb
          .collection(COLLECTIONS.INSIGHTS)
          .where("user_id", "==", ctx.userId)
          .where("is_dismissed", "==", false);

        if (type !== "all") {
          query = query.where("insight_type", "==", type);
        }

        if (unreadOnly) {
          query = query.where("is_read", "==", false);
        }

        const data = normalizeInsights(
          (
            await query
              .orderBy("generated_at", "desc")
              .limit(normalizedLimit)
              .get()
          ).docs,
          {
            limit: normalizedLimit,
            type,
            unreadOnly,
          }
        );

        return {
          ok: true,
          message: data.length > 0 ? "Recent insights loaded." : "No recent insights found yet.",
          action:
            data.length === 0
              ? "Use raw data tools (YouTube/Shopify metrics) or run a fresh sync."
              : undefined,
          insights: data,
        };
      } catch (error) {
        console.warn(
          "Primary insights query failed, retrying with user-scoped fallback.",
          error
        );

        try {
          const fallbackSnapshot = await ctx.adminDb
            .collection(COLLECTIONS.INSIGHTS)
            .where("user_id", "==", ctx.userId)
            .limit(Math.max(normalizedLimit * 4, 50))
            .get();

          const insights = normalizeInsights(fallbackSnapshot.docs, {
            limit: normalizedLimit,
            type,
            unreadOnly,
          });

          return {
            ok: true,
            message:
              insights.length > 0
                ? "Recent insights loaded."
                : "No recent insights found yet.",
            action:
              insights.length === 0
                ? "Use raw data tools (YouTube/Shopify metrics) or run a fresh sync."
                : undefined,
            insights,
          };
        } catch (fallbackError) {
          console.error("Insights fallback query failed:", fallbackError);

          return {
            ok: false,
            errorCode: "INSIGHTS_QUERY_FAILED",
            message: "Failed to load recent insights.",
            action: "Try again after your next sync.",
            insights: [],
          };
        }
      }
    },
  });
}
