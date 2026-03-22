import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import { COLLECTIONS } from "@/lib/firebase/schema";
import {
  summarizeCollectionsDataset,
  type CollectionsSummary,
  type RazorpayPaymentRecord,
  type ShopifyOrderRecord,
} from "./collections-shared";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function normalizeStartBoundary(input: string) {
  return DATE_ONLY_PATTERN.test(input) ? `${input}T00:00:00.000Z` : input;
}

function normalizeEndBoundary(input: string) {
  return DATE_ONLY_PATTERN.test(input) ? `${input}T23:59:59.999Z` : input;
}

function calculatePercentChange(current: number, previous: number) {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }

  return ((current - previous) / previous) * 100;
}

function computePreviousPeriod(periodStart: string, periodEnd: string) {
  const currentStart = new Date(normalizeStartBoundary(periodStart));
  const currentEnd = new Date(normalizeEndBoundary(periodEnd));

  if (
    Number.isNaN(currentStart.getTime()) ||
    Number.isNaN(currentEnd.getTime()) ||
    currentEnd.getTime() < currentStart.getTime()
  ) {
    return null;
  }

  const durationMs = currentEnd.getTime() - currentStart.getTime() + 1;
  const previousEnd = new Date(currentStart.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - durationMs + 1);

  return {
    periodStart: previousStart.toISOString(),
    periodEnd: previousEnd.toISOString(),
  };
}

function buildUpiShareInsight(
  current: CollectionsSummary,
  previous: CollectionsSummary
) {
  const currentUpi = current.methodSegments.find(
    (segment) => segment.method === "upi"
  );
  const previousUpi = previous.methodSegments.find(
    (segment) => segment.method === "upi"
  );

  if (
    current.razorpayTotal <= 0 ||
    previous.razorpayTotal <= 0 ||
    !currentUpi ||
    !previousUpi
  ) {
    return null;
  }

  const change = currentUpi.percentage - previousUpi.percentage;
  if (Math.abs(change) < 0.1) {
    return `UPI held steady at ${currentUpi.percentage.toFixed(1)}% of Razorpay collections.`;
  }

  return change > 0
    ? `UPI share rose to ${currentUpi.percentage.toFixed(1)}% of Razorpay collections from ${previousUpi.percentage.toFixed(1)}% in the previous period.`
    : `UPI share slipped to ${currentUpi.percentage.toFixed(1)}% of Razorpay collections from ${previousUpi.percentage.toFixed(1)}% in the previous period.`;
}

async function loadShopifyOrders(
  ctx: ToolContext,
  periodStart: string,
  periodEnd: string
) {
  const snapshot = await ctx.adminDb
    .collection(COLLECTIONS.ORDERS)
    .where("user_id", "==", ctx.userId)
    .where("placed_at", ">=", normalizeStartBoundary(periodStart))
    .where("placed_at", "<=", normalizeEndBoundary(periodEnd))
    .get();

  return snapshot.docs.map((doc) => doc.data() as ShopifyOrderRecord);
}

async function loadRazorpayPayments(
  ctx: ToolContext,
  periodStart: string,
  periodEnd: string
) {
  const snapshot = await ctx.adminDb
    .collection(COLLECTIONS.RAZORPAY_PAYMENTS)
    .where("user_id", "==", ctx.userId)
    .where("created_at_source", ">=", normalizeStartBoundary(periodStart))
    .where("created_at_source", "<=", normalizeEndBoundary(periodEnd))
    .get();

  return snapshot.docs.map((doc) => doc.data() as RazorpayPaymentRecord);
}

async function loadRelevantIntegrations(ctx: ToolContext) {
  const snapshot = await ctx.adminDb
    .collection(COLLECTIONS.INTEGRATIONS)
    .where("user_id", "==", ctx.userId)
    .get();

  return snapshot.docs
    .map((doc) => doc.data() as { provider?: string; status?: string })
    .filter(
      (integration) =>
        integration.provider === "shopify" || integration.provider === "razorpay"
    );
}

function buildEmptyCollectionsMessage(
  integrations: Array<{ provider?: string; status?: string }>
) {
  if (integrations.length === 0) {
    return "No collections data found. Connect Shopify or Razorpay to answer this.";
  }

  return "No collections were found for this period yet. Shopify or Razorpay sync may still be in progress.";
}

export function getCollectionsOverview(ctx: ToolContext) {
  return tool({
    description:
      "Get collections and channel totals for a time period, combining Shopify sales with Razorpay payments. Use this for questions like how much we did this month, Shopify vs UPI, or profit-style prompts.",
    inputSchema: z.object({
      periodStart: z.string().describe("ISO date or datetime"),
      periodEnd: z.string().describe("ISO date or datetime"),
    }),
    execute: async ({ periodStart, periodEnd }) => {
      const [shopifyOrders, razorpayPayments, integrations] = await Promise.all([
        loadShopifyOrders(ctx, periodStart, periodEnd),
        loadRazorpayPayments(ctx, periodStart, periodEnd),
        loadRelevantIntegrations(ctx),
      ]);

      const current = summarizeCollectionsDataset({
        shopifyOrders,
        razorpayPayments,
      });

      const previousPeriod = computePreviousPeriod(periodStart, periodEnd);
      const previous = previousPeriod
        ? summarizeCollectionsDataset({
            shopifyOrders: await loadShopifyOrders(
              ctx,
              previousPeriod.periodStart,
              previousPeriod.periodEnd
            ),
            razorpayPayments: await loadRazorpayPayments(
              ctx,
              previousPeriod.periodStart,
              previousPeriod.periodEnd
            ),
          })
        : summarizeCollectionsDataset({
            shopifyOrders: [],
            razorpayPayments: [],
          });

      const message =
        current.combinedTotal === 0
          ? buildEmptyCollectionsMessage(integrations)
          : undefined;

      return {
        clarification:
          "I can show collections/revenue, not true profit yet.",
        currency: current.currency,
        periodStart: normalizeStartBoundary(periodStart),
        periodEnd: normalizeEndBoundary(periodEnd),
        shopifyTotal: current.shopifyTotal,
        razorpayTotal: current.razorpayTotal,
        combinedTotal: current.combinedTotal,
        razorpayByMethod: current.methodSegments,
        previousPeriod: {
          shopifyTotal: previous.shopifyTotal,
          razorpayTotal: previous.razorpayTotal,
          combinedTotal: previous.combinedTotal,
        },
        percentChanges: {
          shopify: calculatePercentChange(
            current.shopifyTotal,
            previous.shopifyTotal
          ),
          razorpay: calculatePercentChange(
            current.razorpayTotal,
            previous.razorpayTotal
          ),
          combined: calculatePercentChange(
            current.combinedTotal,
            previous.combinedTotal
          ),
        },
        insight: buildUpiShareInsight(current, previous),
        message,
      };
    },
  });
}

export function getCollectionsBreakdown(ctx: ToolContext) {
  return tool({
    description:
      "Break down collections by channel, Razorpay payment method, or day. Use this for Shopify vs UPI or payment-method split questions.",
    inputSchema: z.object({
      periodStart: z.string().describe("ISO date or datetime"),
      periodEnd: z.string().describe("ISO date or datetime"),
      breakdownBy: z.enum(["channel", "payment_method", "day"]),
    }),
    execute: async ({ periodStart, periodEnd, breakdownBy }) => {
      const [shopifyOrders, razorpayPayments, integrations] = await Promise.all([
        loadShopifyOrders(ctx, periodStart, periodEnd),
        loadRazorpayPayments(ctx, periodStart, periodEnd),
        loadRelevantIntegrations(ctx),
      ]);

      const summary = summarizeCollectionsDataset({
        shopifyOrders,
        razorpayPayments,
      });

      const message =
        summary.combinedTotal === 0
          ? buildEmptyCollectionsMessage(integrations)
          : undefined;

      if (breakdownBy === "channel") {
        return {
          currency: summary.currency,
          total: summary.combinedTotal,
          segments: summary.channelSegments,
          message,
        };
      }

      if (breakdownBy === "payment_method") {
        return {
          currency: summary.currency,
          total: summary.razorpayTotal,
          segments: summary.methodSegments,
          message,
        };
      }

      return {
        currency: summary.currency,
        total: summary.combinedTotal,
        segments: summary.daySegments,
        message,
      };
    },
  });
}
