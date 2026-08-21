import { NextRequest, NextResponse } from "next/server";
import DodoPayments from "dodopayments";
import { getUserFromRequest } from "@/lib/firebase/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyPremiumGating } from "@/lib/firebase/middleware";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("PaymentsCheckoutRoute");

/**
 * Extract the request origin (protocol + host).
 */
function getOrigin(request: NextRequest): string {
  try {
    const proto = request.headers.get("x-forwarded-proto") || "http";
    const host =
      request.headers.get("x-forwarded-host") ||
      request.headers.get("host") ||
      "localhost:3000";
    return `${proto}://${host}`;
  } catch {
    return "http://localhost:3000";
  }
}

/**
 * Build the Dodo return_url (success).
 * Sends users to /payment/success?from=<returnPath> so they
 * see a confirmation screen and can navigate back.
 */
function getReturnUrl(request: NextRequest, returnPath?: string | null) {
  const origin = getOrigin(request);
  const safe = returnPath && returnPath.startsWith("/") ? returnPath : "/chat/new";

  // If a custom env override is set and it already points to our success page, honour it.
  const envUrl = process.env.DODO_PAYMENTS_RETURN_URL;
  if (envUrl && envUrl.trim() && envUrl.includes("/payment/success")) {
    return envUrl.trim();
  }

  return `${origin}/payment/success?from=${encodeURIComponent(safe)}`;
}

/**
 * Build the Dodo cancel_url.
 * Sends users to /payment/cancelled?from=<returnPath> when they abandon checkout.
 */
function getCancelUrl(request: NextRequest, returnPath?: string | null) {
  const origin = getOrigin(request);
  const safe = returnPath && returnPath.startsWith("/") ? returnPath : "/chat/new";
  return `${origin}/payment/cancelled?from=${encodeURIComponent(safe)}`;
}

export async function POST(request: NextRequest) {
  let userIdLog: string | undefined;
  let productIdLog: string | undefined;
  let keyMode: "test_mode" | "live_mode" | "unknown" = "unknown";
  let returnPathFromBody: string | null = null;
  try {
    // Attempt to read an optional returnPath sent by the client so we can
    // redirect back to the correct page after a successful payment.
    try {
      const raw = await request.clone().json();
      if (typeof raw?.returnPath === "string" && raw.returnPath.startsWith("/")) {
        returnPathFromBody = raw.returnPath;
      }
    } catch {
      // Body may be empty — this is fine, we fall back to /chat/new.
    }
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = data.user.id;
    userIdLog = userId;
    const email = data.user.email || undefined;

    // Prevent paid users from opening checkout
    const isPremium = await verifyPremiumGating(userId);
    if (isPremium) {
      return NextResponse.json({ error: "Already on a paid plan" }, { status: 403 });
    }

    const productId = process.env.DODO_REGULAR_PRODUCT_ID;
    productIdLog = productId;
    if (!productId) {
      log.error("Missing DODO_REGULAR_PRODUCT_ID");
      return NextResponse.json({ error: "Server not configured (product)" }, { status: 500 });
    }

    const apiKey = process.env.DODO_PAYMENTS_API_KEY;
    if (!apiKey) {
      log.error("Missing DODO_PAYMENTS_API_KEY");
      return NextResponse.json({ error: "Server not configured (api key)" }, { status: 500 });
    }

    let environment = (process.env.DODO_PAYMENTS_ENVIRONMENT || "live_mode") as
      | "test_mode"
      | "live_mode";

    // Infer key mode from prefix and auto-correct mismatches (safe; no secret logging)
    if (apiKey.startsWith("dodo_test_")) keyMode = "test_mode";
    else if (apiKey.startsWith("dodo_live_")) keyMode = "live_mode";
    else keyMode = "unknown";

    if (keyMode !== "unknown" && keyMode !== environment) {
      log.warn("API key/env mismatch; overriding environment to match key prefix", {
        from: environment,
        to: keyMode,
      });
      environment = keyMode as "test_mode" | "live_mode";
    }

    const client = new DodoPayments({
      bearerToken: apiKey,
      environment,
    });

    const returnUrl = getReturnUrl(request, returnPathFromBody);
    const cancelUrl = getCancelUrl(request, returnPathFromBody);

    const session = await client.checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: email ? { email } : undefined,
      return_url: returnUrl,
      // cancel_url routes abandonment back to our branded cancelled page.
      ...(cancelUrl ? { cancel_url: cancelUrl } : {}),
      metadata: {
        firebase_user_id: userId,
        plan_target: "business",
        source: "rearvy_chat_upgrade",
      } as Record<string, string>,
    });

    if (!session?.checkout_url) {
      log.error("Checkout session created but no checkout_url", {
        sessionId: session?.session_id,
      });
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: 502 }
      );
    }

    // Optional: write a lightweight audit trail
    try {
      await adminDb.collection("assistant_alerts").add({
        user_id: userId,
        chat_id: null,
        project_id: null,
        message_id: null,
        title: "Business upgrade checkout started",
        summary: "User initiated Business plan ($20/month) via Dodo Payments.",
        message_text: `Session: ${session.session_id}`,
        severity: "info",
        source: "billing",
        is_read: false,
        read_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } catch (auditErr) {
      log.warn("Audit write failed", auditErr as Error);
    }

    return NextResponse.json({ checkout_url: session.checkout_url });
  } catch (err) {
    const e = err as any;
    const env = (process.env.DODO_PAYMENTS_ENVIRONMENT || "live_mode") as "test_mode" | "live_mode";

    const structured = {
      name: e?.name ?? undefined,
      message: e?.message ?? "unknown error",
      status: e?.status ?? e?.statusCode ?? e?.response?.status ?? undefined,
      code: e?.code ?? e?.error_code ?? undefined,
      request_id: e?.requestId ?? e?.response?.headers?.["x-request-id"] ?? undefined,
    };

    log.error("Unhandled error creating checkout session", {
      environment: env,
      key_mode: keyMode,
      productId: productIdLog,
      userId: userIdLog,
      details: structured,
    });

    if (env === "test_mode") {
      return NextResponse.json(
        { error: "checkout_creation_failed", details: structured },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}