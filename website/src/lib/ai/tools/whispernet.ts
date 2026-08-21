import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import { runWhisperNetScanForUser, getWhisperNetSummary } from "@/lib/whispernet/service";
import { getErrorMessage } from "@/lib/error-utils";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("WhispernetTool");

export function runWhispernetAnalysis(ctx: ToolContext) {
  return tool({
    description:
      "Run a deep Whispernet analysis to detect social mentions, forecast stockout risks, and project incremental revenue from social waves. Use this tool whenever the user asks about revenue, products, customers, orders, inventory, YouTube, Instagram, or competitors, or when they want a business intelligence update. This tool provides real-time market sentiment and predictive sales signals.",
    inputSchema: z.object({
      forceScan: z.boolean().optional().default(true).describe("Whether to run a fresh scan before returning results (recommended for latest data)"),
    }),
    execute: async ({ forceScan }) => {
      try {
        if (forceScan) {
          // Trigger a fresh scan to ensure data is up to date
          await runWhisperNetScanForUser(ctx.adminDb, ctx.userId, "internal");
        }
        
        const summary = await getWhisperNetSummary(ctx.adminDb, ctx.userId);
        
        return {
          success: true,
          stats: summary.stats,
          recentMentions: summary.mentions.slice(0, 10).map(m => ({
            platform: m.platform,
            product: m.product_title,
            source: m.source_title,
            url: m.source_url,
            creator: m.creator_name,
            matched_text: m.matched_text,
            published_at: m.published_at,
            forecast: m.forecast ? {
              incremental_revenue: m.forecast.predicted_incremental_revenue_48h,
              incremental_units: m.forecast.predicted_incremental_units_48h,
              stockout_risk: m.forecast.stockout_risk,
              confidence: m.forecast.confidence
            } : null
          })),
          activeAlerts: summary.alerts.map(a => ({
            severity: a.severity,
            title: a.title,
            summary: a.summary,
            recommended_action: a.recommended_action,
            product: a.product_title
          })),
          lastRunAt: summary.lastRunAt,
          integrationsStatus: summary.integrations,
          message: "Whispernet analysis completed successfully. Use the provided mentions and alerts to give the user a comprehensive business update."
        };
      } catch (error) {
        log.error("Whispernet tool error:", error);
        return {
          success: false,
          error: getErrorMessage(error, "Failed to run Whispernet analysis"),
        };
      }
    },
  });
}
