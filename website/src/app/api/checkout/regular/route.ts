import { NextRequest, NextResponse } from "next/server";
import DodoPayments from "dodopayments";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("CheckoutRegularApi");

function reqJsonSafe<T = unknown>(req: NextRequest): Promise<T | null> {
  return req
    .json()
    .then((v) => v as T)
    .catch(() => null);
}

function ensureEnv(name: string, value: string | undefined) {
  if (!value || !value.trim()) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value.trim();
}

function createClient() {
  const bearerToken = ensureEnv("DODO_PAYMENTS_API_KEY", process.env.DODO_PAYMENTS_API_KEY);
  const environment = (process.env.DODO_PAYMENTS_ENVIRONMENT || "test_mode").trim() as "test_mode" | "live_mode";
  return new DodoPayments({ bearerToken, environment });
}

type CreateCheckoutBody = {
  customer?: { email?: string; name?: string; phone_number?: string } | null;
  billing_address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string; // ISO 3166-1 alpha-2 (recommended)
    zipcode?: string;
  } | null;
  // Optional UI flags
  allow_discount_code?: boolean;
  // Optional override to force applying or skipping earlybird
  apply_earlybird?: boolean;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await reqJsonSafe<CreateCheckoutBody>(request)) || {};
    const client = createClient();

    const productId = ensureEnv("DODO_REGULAR_PRODUCT_ID", process.env.DODO_REGULAR_PRODUCT_ID);
    const returnUrl = ensureEnv("DODO_PAYMENTS_RETURN_URL", process.env.DODO_PAYMENTS_RETURN_URL);
    const earlybirdCode = (process.env.DODO_EARLYBIRD_CODE || "").trim();

    // Decide whether to attempt earlybird
    let shouldTryEarlybird = Boolean(earlybirdCode);
    if (typeof body.apply_earlybird === "boolean") {
      shouldTryEarlybird = body.apply_earlybird && Boolean(earlybirdCode);
    }

    // Check discount usage before applying to reduce 422s
    let earlybirdUsable = false;
    if (shouldTryEarlybird) {
      try {
        const d = await client.discounts.retrieveByCode(earlybirdCode);
        // If usage_limit is null (unlimited) or times_used < usage_limit, consider usable.
        const limit = typeof (d as any)?.usage_limit === "number" ? (d as any).usage_limit : null;
        const used = typeof (d as any)?.times_used === "number" ? (d as any).times_used : 0;
        earlybirdUsable = limit === null || used < limit;
      } catch (e) {
        // Not fatal — just skip applying the code
        earlybirdUsable = false;
        log.warn("Earlybird retrieveByCode failed; proceeding without code", e);
      }
    }

    const basePayload: Record<string, unknown> = {
      product_cart: [{ product_id: productId, quantity: 1 }],
      return_url: returnUrl,
    };

    if (body.customer) {
      basePayload.customer = {
        email: body.customer.email,
        name: body.customer.name,
        phone_number: body.customer.phone_number,
      };
    }

    if (body.billing_address) {
      basePayload.billing_address = body.billing_address;
    }

    if (body.allow_discount_code === true) {
      basePayload.feature_flags = { allow_discount_code: true };
    }

    let session;
    let appliedDiscount = false;

    if (earlybirdUsable) {
      try {
        session = await client.checkoutSessions.create({
          ...(basePayload as any),
          discount_codes: [earlybirdCode],
        });
        appliedDiscount = true;
      } catch (err: any) {
        // If earlybird fails (expired/usage exceeded), retry without discount
        const status = typeof err?.status === "number" ? err.status : undefined;
        const message = typeof err?.message === "string" ? err.message : String(err);
        log.warn("Checkout with earlybird failed, retrying without discount", { status, message });
        session = await client.checkoutSessions.create(basePayload as any);
        appliedDiscount = false;
      }
    } else {
      session = await client.checkoutSessions.create(basePayload as any);
    }

    return NextResponse.json(
      {
        checkout_url: (session as any)?.checkout_url,
        session_id: (session as any)?.session_id,
        applied_discount: appliedDiscount,
      },
      { status: 200 }
    );
  } catch (error) {
    log.error("Failed to create regular checkout session", error);
    return NextResponse.json(
      { error: "Unable to create checkout session." },
      { status: 500 }
    );
  }
}