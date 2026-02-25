import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import { getYouTubeSchemaHealth } from "@/lib/integrations/schema-health";

export function getIntegrationStatus(ctx: ToolContext) {
  return tool({
    description: "Check which platforms are connected and their sync status",
    inputSchema: z.object({}),
    execute: async () => {
      const { data, error } = await ctx.supabase
        .from("integrations")
        .select(
          "provider, status, last_synced_at, provider_account_name"
        )
        .eq("user_id", ctx.userId);

      if (error) {
        return {
          ok: false,
          errorCode: "INTEGRATION_STATUS_QUERY_FAILED",
          message: "Failed to load integration status.",
          action: "Try again in a moment or reconnect your integrations.",
          integrations: [],
        };
      }

      const integrations = (data || []).map((i) => ({
        provider: i.provider,
        status: i.status,
        lastSyncedAt: i.last_synced_at,
        accountName: i.provider_account_name,
      }));

      const hasYouTube = integrations.some((i) => i.provider === "youtube");
      const youtubeSchema = hasYouTube
        ? await getYouTubeSchemaHealth(ctx.supabase)
        : null;

      return {
        ok: true,
        message: "Integration status loaded.",
        action:
          youtubeSchema && !youtubeSchema.ok
            ? `Run missing migrations for: ${youtubeSchema.missingTables.join(", ")}`
            : undefined,
        integrations,
        diagnostics: {
          youtubeSchemaReady: youtubeSchema ? youtubeSchema.ok : true,
          missingTables: youtubeSchema?.missingTables || [],
          tableErrors: youtubeSchema?.errors || {},
        },
      };
    },
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getCurrentDate(_ctx: ToolContext) {
  return tool({
    description: "Get the current date and day of week",
    inputSchema: z.object({}),
    execute: async () => {
      const now = new Date();
      const days = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      return {
        date: now.toISOString().split("T")[0],
        dayOfWeek: days[now.getDay()],
        timestamp: now.toISOString(),
      };
    },
  });
}
