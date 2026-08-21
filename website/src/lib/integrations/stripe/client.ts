import { Firestore } from "firebase-admin/firestore";
import { encrypt } from "@/lib/utils/encryption";
import { COLLECTIONS } from "@/lib/firebase/schema";

const STRIPE_API_BASE = "https://api.stripe.com/v1";
const STRIPE_OAUTH_BASE = "https://connect.stripe.com/oauth";

export interface StripeConfig {
  accessToken: string;
  stripeUserId?: string;
  refreshToken?: string;
  livemode?: boolean;
}

export interface StripeInvoice {
  id: string;
  number: string | null;
  status: string;
  amount_due: number;
  currency: string;
  customer_email: string | null;
  created: number;
  hosted_invoice_url: string | null;
}

export interface StripeCharge {
  id: string;
  amount: number;
  currency: string;
  status: string;
  customer_email: string | null;
  created: number;
  description: string | null;
}

export interface StripeSubscription {
  id: string;
  status: string;
  current_period_start: number;
  current_period_end: number;
  plan_amount: number | null;
  plan_currency: string | null;
  customer_email: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function optionalString(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function optionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export async function exchangeStripeCode(
  code: string,
  redirectUri: string,
): Promise<StripeConfig> {
  const clientId = process.env.STRIPE_CLIENT_ID;
  const clientSecret = process.env.STRIPE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing Stripe OAuth credentials.");
  }

  const res = await fetch(`${STRIPE_OAUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }).toString(),
  });

  const data: unknown = await res.json().catch(() => null);
  const payload = isRecord(data) ? data : {};

  const accessToken = optionalString(payload.access_token);
  if (!accessToken) {
    throw new Error(
      optionalString(payload.error_description) || "Stripe OAuth failed.",
    );
  }

  return {
    accessToken,
    stripeUserId: optionalString(payload.stripe_user_id),
    refreshToken: optionalString(payload.refresh_token),
    livemode: payload.livemode === true,
  };
}

export async function stripeApiCall<T>(
  config: StripeConfig,
  path: string,
  params: Record<string, string> = {},
): Promise<T> {
  const url = new URL(`${STRIPE_API_BASE}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Stripe-Version": "2023-10-16",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe API error (${res.status}): ${text}`);
  }

  return (await res.json()) as T;
}

export async function listStripeInvoices(
  config: StripeConfig,
  limit = 10,
): Promise<StripeInvoice[]> {
  const data = await stripeApiCall<{
    data?: Array<Record<string, unknown>>;
  }>(config, "invoices", { limit: String(limit) });

  return (Array.isArray(data.data) ? data.data : []).map((inv) => ({
    id: optionalString(inv.id) || "",
    number: optionalString(inv.number) || null,
    status: optionalString(inv.status) || "unknown",
    amount_due: optionalNumber(inv.amount_due) ?? 0,
    currency: optionalString(inv.currency) || "usd",
    customer_email: optionalString(inv.customer_email) || null,
    created: optionalNumber(inv.created) ?? 0,
    hosted_invoice_url: optionalString(inv.hosted_invoice_url) || null,
  }));
}

export async function listStripeCharges(
  config: StripeConfig,
  limit = 10,
): Promise<StripeCharge[]> {
  const data = await stripeApiCall<{
    data?: Array<Record<string, unknown>>;
  }>(config, "charges", { limit: String(limit) });

  return (Array.isArray(data.data) ? data.data : []).map((charge) => ({
    id: optionalString(charge.id) || "",
    amount: optionalNumber(charge.amount) ?? 0,
    currency: optionalString(charge.currency) || "usd",
    status: optionalString(charge.status) || "unknown",
    customer_email: optionalString(charge.customer_email) || null,
    created: optionalNumber(charge.created) ?? 0,
    description: optionalString(charge.description) || null,
  }));
}

export async function listStripeSubscriptions(
  config: StripeConfig,
  limit = 10,
): Promise<StripeSubscription[]> {
  const data = await stripeApiCall<{
    data?: Array<Record<string, unknown>>;
  }>(config, "subscriptions", { limit: String(limit), status: "all" });

  return (Array.isArray(data.data) ? data.data : []).map((sub) => {
    const plan = isRecord(sub.plan) ? sub.plan : {};
    return {
      id: optionalString(sub.id) || "",
      status: optionalString(sub.status) || "unknown",
      current_period_start: optionalNumber(sub.current_period_start) ?? 0,
      current_period_end: optionalNumber(sub.current_period_end) ?? 0,
      plan_amount: optionalNumber(plan.amount ?? null) ?? null,
      plan_currency: optionalString(plan.currency) || null,
      customer_email: optionalString(sub.customer_email) || null,
    };
  });
}

export async function persistStripeConnection(
  db: Firestore,
  userId: string,
  config: StripeConfig,
): Promise<string> {
  const { encrypted, iv } = encrypt(config.accessToken);
  const ref = db.collection(COLLECTIONS.INTEGRATIONS).doc();

  await ref.set({
    id: ref.id,
    user_id: userId,
    provider: "stripe",
    provider_account_id: config.stripeUserId ?? null,
    provider_account_name: config.stripeUserId
      ? `Stripe ${config.stripeUserId}`
      : "Stripe",
    access_token_enc: encrypted,
    token_iv: iv,
    refresh_token_enc: config.refreshToken
      ? encrypt(config.refreshToken).encrypted
      : undefined,
    refresh_token_iv: config.refreshToken
      ? encrypt(config.refreshToken).iv
      : undefined,
    scopes: ["read_only"],
    token_expires_at: null,
    status: "active",
    last_synced_at: null,
    sync_cursor: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  return ref.id;
}
