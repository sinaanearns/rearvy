import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import { adminDb } from "@/lib/firebase/admin";
import { loadStripeConnectionForUser } from "@/lib/integrations/stripe/server";
import {
  listStripeInvoices,
  listStripeCharges,
  listStripeSubscriptions,
  type StripeConfig,
} from "@/lib/integrations/stripe/client";

function formatAmount(amount: number, currency: string): string {
  const major = amount / 100;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(major);
  } catch {
    return `${currency.toUpperCase()} ${major.toFixed(2)}`;
  }
}

export function getStripeInvoicesTool(ctx: ToolContext) {
  void ctx;
  return tool({
    description:
      "List recent Stripe invoices for the connected account. Requires Stripe to be connected. Read-only (draft-only policy — never issues charges).",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(50).default(10),
    }),
    execute: async ({ limit }) => {
      const connection = await loadStripeConnectionForUser(adminDb, ctx.userId);
      if (!connection.ok) {
        return { ok: false, error: connection.message, errorCode: connection.errorCode };
      }

      const invoices = await listStripeInvoices(connection.config as StripeConfig, limit);
      return {
        ok: true,
        invoices: invoices.map((i) => ({
          id: i.id,
          number: i.number,
          status: i.status,
          amount_due: formatAmount(i.amount_due, i.currency),
          customer: i.customer_email,
        })),
        message: `Retrieved ${invoices.length} Stripe invoices.`,
      };
    },
  });
}

export function getStripeChargesTool(ctx: ToolContext) {
  void ctx;
  return tool({
    description:
      "List recent Stripe charges for the connected account. Requires Stripe to be connected. Read-only.",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(50).default(10),
    }),
    execute: async ({ limit }) => {
      const connection = await loadStripeConnectionForUser(adminDb, ctx.userId);
      if (!connection.ok) {
        return { ok: false, error: connection.message, errorCode: connection.errorCode };
      }

      const charges = await listStripeCharges(connection.config as StripeConfig, limit);
      return {
        ok: true,
        charges: charges.map((c) => ({
          id: c.id,
          amount: formatAmount(c.amount, c.currency),
          status: c.status,
          customer: c.customer_email,
          description: c.description,
        })),
        message: `Retrieved ${charges.length} Stripe charges.`,
      };
    },
  });
}

export function getStripeSubscriptionsTool(ctx: ToolContext) {
  void ctx;
  return tool({
    description:
      "List Stripe subscriptions for the connected account. Requires Stripe to be connected. Read-only.",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(50).default(10),
    }),
    execute: async ({ limit }) => {
      const connection = await loadStripeConnectionForUser(adminDb, ctx.userId);
      if (!connection.ok) {
        return { ok: false, error: connection.message, errorCode: connection.errorCode };
      }

      const subs = await listStripeSubscriptions(connection.config as StripeConfig, limit);
      return {
        ok: true,
        subscriptions: subs.map((s) => ({
          id: s.id,
          status: s.status,
          amount: s.plan_amount != null ? formatAmount(s.plan_amount, s.plan_currency || "usd") : null,
          customer: s.customer_email,
        })),
        message: `Retrieved ${subs.length} Stripe subscriptions.`,
      };
    },
  });
}
