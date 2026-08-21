import { NextRequest, NextResponse } from "next/server";
import DodoPayments from "dodopayments";
import { getUserFromRequest } from "@/lib/firebase/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyPremiumGating } from "@/lib/firebase/middleware";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("SubscribeRoute");

function getReturnUrl(request: NextRequest) {
  const envUrl = process.env.DODO_PAYMENTS_RETURN_URL;
  if (envUrl && envUrl.trim()) return envUrl.trim();

  try {
    const proto = request.headers.get("x-forwarded-proto") || "http";
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost:3000";
    return `${proto}://${host}/chat`;
  } catch {
    return "http://localhost:3000/chat";
  }
}

export async function POST(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = data.user.id;
    const email = data.user.email || undefined;

    // Only allow NORMAL chat users (free plan) to start this subscription checkout
    const isPremium = await verifyPremiumGating(userId);
    if (isPremium) {
      return NextResponse.json({ error: "Already on a paid plan" }, { status: 403 });
    }

    const productId = process.env.DODO_REGULAR_PRODUCT_ID;
    if (!productId) {
      log.error("Missing DODO_REGULAR_PRODUCT_ID");
      return NextResponse.json({ error: "Server not configured (product)" }, { status: 500 });
    }

    const apiKey = process.env.DODO_PAYMENTS_API_KEY;
    if (!apiKey) {
      log.error("Missing DODO_PAYMENTS_API_KEY");
      return NextResponse.json({ error: "Server not configured (api key)" }, { status: 500 });
    }

    const environment = (process.env.DODO_PAYMENTS_ENVIRONMENT || "live_mode") as "test_mode" | "live_mode";

    const client = new DodoPayments({
      bearerToken: apiKey,
      environment,
    });

    // Pre-fill customer, attach metadata for reliable webhook correlation
    const returnUrl = getReturnUrl(request);
    const session = await client.checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: email ? { email } : undefined,
      return_url: returnUrl,
      metadata: {
        firebase_user_id: userId,
        plan_target: "business",
        source: "rearvy_home_subscribe",
      } as Record<string, string>,
    });

    if (!session?.checkout_url) {
      log.error("Checkout session created but no checkout_url present", { sessionId: session?.session_id });
      return NextResponse.json({ error: "Failed to create checkout session" }, { status: 502 });
    }

    // Optionally record a pending subscription intent (audit)
    try {
      await adminDb
        .collection("assistant_alerts")
        .add({
          user_id: userId,
          chat_id: null,
          project_id: null,
          message_id: null,
          title: "Subscription checkout started",
          summary: "User initiated Business plan upgrade via Dodo Payments.",
          message_text: `Session: ${session.session_id}`,
          severity: "info",
          source: "billing",
          is_read: false,
          read_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
    } catch (auditError) {
      log.warn("Failed to write audit alert for subscription intent", auditError as Error);
    }

    return NextResponse.json({ checkout_url: session.checkout_url });
  } catch (err) {
    log.error("Unhandled error creating checkout session", err as Error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}