import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";

export function getIntegrationStatus(ctx: ToolContext) {
  return tool({
    description: "Check which platforms are connected and their sync status",
    inputSchema: z.object({}),
    execute: async () => {
      const { data } = await ctx.supabase
        .from("integrations")
        .select(
          "provider, status, last_synced_at, provider_account_name"
        )
        .eq("user_id", ctx.userId);

      return {
        integrations: (data || []).map((i) => ({
          provider: i.provider,
          status: i.status,
          lastSyncedAt: i.last_synced_at,
          accountName: i.provider_account_name,
        })),
      };
    },
  });
}

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
