import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { decrypt } from "@/lib/utils/encryption";
import {
  ensureValidToken,
  runReport,
  type GA4Config,
} from "@/lib/integrations/google-analytics/client";

type StoredGoogleAnalyticsIntegration = {
  provider_account_id?: string | null;
  provider_account_name?: string | null;
  access_token_enc?: string;
  refresh_token_enc?: string;
  token_iv?: string;
  token_expires_at?: string | null;
  sync_cursor?: {
    refresh_iv?: string;
  } | null;
};

type GoogleAnalyticsConnection = {
  integrationId: string;
  propertyId: string;
  propertyName: string;
  config: GA4Config;
};

function toDateOnly(value: Date) {
  return value.toISOString().split("T")[0];
}

function normalizeDateInput(input: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return input;
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date input: ${input}`);
  }

  return toDateOnly(parsed);
}

function resolveDateRange(params: {
  days?: number;
  startDate?: string;
  endDate?: string;
}) {
  if (params.startDate || params.endDate) {
    if (!params.startDate || !params.endDate) {
      throw new Error("Provide both startDate and endDate for a custom range.");
    }

    return {
      startDate: normalizeDateInput(params.startDate),
      endDate: normalizeDateInput(params.endDate),
    };
  }

  const days = Math.min(Math.max(params.days || 30, 1), 365);
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setUTCDate(startDate.getUTCDate() - (days - 1));

  return {
    startDate: toDateOnly(startDate),
    endDate: toDateOnly(endDate),
  };
}

function parseMetricValue(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePercentage(value: string | undefined) {
  const parsed = parseMetricValue(value);
  if (parsed <= 1) {
    return parsed * 100;
  }

  return parsed;
}

async function getGoogleAnalyticsConnection(
  ctx: ToolContext
): Promise<GoogleAnalyticsConnection | null> {
  const snapshot = await ctx.adminDb
    .collection(COLLECTIONS.INTEGRATIONS)
    .where("user_id", "==", ctx.userId)
    .where("provider", "==", "google_analytics")
    .where("status", "==", "active")
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  const integration = doc.data() as StoredGoogleAnalyticsIntegration;
  const refreshIv = integration.sync_cursor?.refresh_iv;

  if (
    !integration.provider_account_id ||
    !integration.access_token_enc ||
    !integration.refresh_token_enc ||
    !integration.token_iv ||
    !refreshIv
  ) {
    throw new Error(
      "The connected Google Analytics account is missing required credentials."
    );
  }

  return {
    integrationId: doc.id,
    propertyId: integration.provider_account_id,
    propertyName:
      integration.provider_account_name || integration.provider_account_id,
    config: {
      accessToken: decrypt(integration.access_token_enc, integration.token_iv),
      refreshToken: decrypt(integration.refresh_token_enc, refreshIv),
      tokenExpiresAt: new Date(integration.token_expires_at || Date.now()),
    },
  };
}

async function runGoogleAnalyticsReport(
  ctx: ToolContext,
  params: {
    dateRanges: Array<{ startDate: string; endDate: string }>;
    dimensions?: Array<{ name: string }>;
    metrics: Array<{ name: string }>;
    limit?: number;
  }
) {
  const connection = await getGoogleAnalyticsConnection(ctx);
  if (!connection) {
    return {
      ok: false as const,
      errorCode: "GA4_NOT_CONNECTED",
      message:
        "No active Google Analytics property is connected yet. Connect GA4 in Integrations first.",
    };
  }

  const accessToken = await ensureValidToken(
    ctx.adminDb,
    connection.integrationId,
    connection.config
  );

  const report = await runReport(
    {
      ...connection.config,
      accessToken,
    },
    connection.propertyId,
    params
  );

  return {
    ok: true as const,
    connection,
    report,
  };
}

export function getGoogleAnalyticsOverview(ctx: ToolContext) {
  return tool({
    description:
      "Get Google Analytics overview metrics such as users, sessions, pageviews, bounce rate, and average session duration.",
    inputSchema: z.object({
      days: z.number().optional().default(30),
      startDate: z
        .string()
        .optional()
        .describe("Optional custom start date in YYYY-MM-DD format."),
      endDate: z
        .string()
        .optional()
        .describe("Optional custom end date in YYYY-MM-DD format."),
    }),
    execute: async ({ days, startDate, endDate }) => {
      try {
        const range = resolveDateRange({ days, startDate, endDate });
        const result = await runGoogleAnalyticsReport(ctx, {
          dateRanges: [range],
          metrics: [
            { name: "activeUsers" },
            { name: "sessions" },
            { name: "screenPageViews" },
            { name: "bounceRate" },
            { name: "averageSessionDuration" },
          ],
        });

        if (!result.ok) {
          return result;
        }

        const row = result.report.rows?.[0];
        const metricValues = row?.metricValues || [];

        return {
          ok: true,
          property: {
            id: result.connection.propertyId,
            name: result.connection.propertyName,
          },
          range,
          users: parseMetricValue(metricValues[0]?.value),
          sessions: parseMetricValue(metricValues[1]?.value),
          pageViews: parseMetricValue(metricValues[2]?.value),
          bounceRatePercent: Math.round(
            normalizePercentage(metricValues[3]?.value) * 100
          ) / 100,
          averageSessionDurationSeconds:
            Math.round(parseMetricValue(metricValues[4]?.value) * 100) / 100,
        };
      } catch (error) {
        return {
          ok: false,
          errorCode: "GA4_OVERVIEW_FAILED",
          message:
            error instanceof Error
              ? error.message
              : "Failed to load Google Analytics overview.",
        };
      }
    },
  });
}

export function getGoogleAnalyticsTopPages(ctx: ToolContext) {
  return tool({
    description:
      "Get the most visited pages from the connected Google Analytics property.",
    inputSchema: z.object({
      days: z.number().optional().default(30),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.number().optional().default(10),
    }),
    execute: async ({ days, startDate, endDate, limit }) => {
      try {
        const range = resolveDateRange({ days, startDate, endDate });
        const result = await runGoogleAnalyticsReport(ctx, {
          dateRanges: [range],
          dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
          metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }],
          limit: Math.min(Math.max(limit, 1), 25),
        });

        if (!result.ok) {
          return result;
        }

        const pages = (result.report.rows || []).map((row) => ({
          path: row.dimensionValues[0]?.value || "/",
          title: row.dimensionValues[1]?.value || null,
          pageViews: parseMetricValue(row.metricValues[0]?.value),
          activeUsers: parseMetricValue(row.metricValues[1]?.value),
        }));

        return {
          ok: true,
          property: {
            id: result.connection.propertyId,
            name: result.connection.propertyName,
          },
          range,
          pages,
        };
      } catch (error) {
        return {
          ok: false,
          errorCode: "GA4_TOP_PAGES_FAILED",
          message:
            error instanceof Error
              ? error.message
              : "Failed to load Google Analytics top pages.",
        };
      }
    },
  });
}

export function getGoogleAnalyticsTrafficSources(ctx: ToolContext) {
  return tool({
    description:
      "Get traffic-source breakdown from the connected Google Analytics property.",
    inputSchema: z.object({
      days: z.number().optional().default(30),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.number().optional().default(10),
    }),
    execute: async ({ days, startDate, endDate, limit }) => {
      try {
        const range = resolveDateRange({ days, startDate, endDate });
        const result = await runGoogleAnalyticsReport(ctx, {
          dateRanges: [range],
          dimensions: [{ name: "sessionSourceMedium" }],
          metrics: [{ name: "sessions" }, { name: "activeUsers" }],
          limit: Math.min(Math.max(limit, 1), 25),
        });

        if (!result.ok) {
          return result;
        }

        return {
          ok: true,
          property: {
            id: result.connection.propertyId,
            name: result.connection.propertyName,
          },
          range,
          sources: (result.report.rows || []).map((row) => ({
            source: row.dimensionValues[0]?.value || "(direct) / (none)",
            sessions: parseMetricValue(row.metricValues[0]?.value),
            activeUsers: parseMetricValue(row.metricValues[1]?.value),
          })),
        };
      } catch (error) {
        return {
          ok: false,
          errorCode: "GA4_TRAFFIC_SOURCES_FAILED",
          message:
            error instanceof Error
              ? error.message
              : "Failed to load Google Analytics traffic sources.",
        };
      }
    },
  });
}
