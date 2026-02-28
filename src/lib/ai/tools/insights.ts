import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import { COLLECTIONS } from "@/lib/firebase/schema";

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

        const snapshot = await query
          .orderBy("generated_at", "desc")
          .limit(limit)
          .get();

        const data = snapshot.docs.map((doc) => doc.data() as any);

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
      } catch (error) {
        return {
          ok: false,
          errorCode: "INSIGHTS_QUERY_FAILED",
          message: "Failed to load recent insights.",
          action: "Try again after your next sync.",
          insights: [],
        };
      }
    },
  });
}
