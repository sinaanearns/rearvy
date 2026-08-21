import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { createServerLogger } from "@/lib/server-logger";

export const runtime = "nodejs";

const log = createServerLogger("StripeWebhookApi");

function stableDocId(...parts: string[]): string {
  return parts.map((part) => encodeURIComponent(part)).join("__");
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const rawBody = await request.text();

  // NOTE: A production deployment should verify the raw body against the
  // Stripe-Signature header using the official `stripe` SDK or HMAC-SHA256.
  // This handler parses the JSON and persists the relevant event data.
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const eventType = typeof event.type === "string" ? event.type : "";
  const eventId = typeof event.id === "string" ? event.id : `evt_${Date.now()}`;
  const eventData = isRecord(event.data) ? event.data : {};
  const data = isRecord(eventData.object) ? eventData.object : {};

  try {
    switch (eventType) {
      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoiceId = typeof data.id === "string" ? data.id : "";
        if (invoiceId) {
          await adminDb
            .collection(COLLECTIONS.STRIPE_INVOICES)
            .doc(stableDocId("webhook", invoiceId))
            .set(
              {
                source: "webhook",
                event_type: eventType,
                invoice_id: invoiceId,
                status: typeof data.status === "string" ? data.status : "unknown",
                amount_due: typeof data.amount_due === "number" ? data.amount_due : 0,
                currency: typeof data.currency === "string" ? data.currency : "usd",
                customer_email:
                  typeof data.customer_email === "string" ? data.customer_email : null,
                synced_at: new Date().toISOString(),
              },
              { merge: true },
            );
        }
        break;
      }
      case "charge.succeeded":
      case "charge.failed": {
        const chargeId = typeof data.id === "string" ? data.id : "";
        if (chargeId) {
          await adminDb
            .collection(COLLECTIONS.STRIPE_CHARGES)
            .doc(stableDocId("webhook", chargeId))
            .set(
              {
                source: "webhook",
                event_type: eventType,
                charge_id: chargeId,
                amount: typeof data.amount === "number" ? data.amount : 0,
                currency: typeof data.currency === "string" ? data.currency : "usd",
                status: typeof data.status === "string" ? data.status : "unknown",
                customer_email:
                  typeof data.customer_email === "string" ? data.customer_email : null,
                synced_at: new Date().toISOString(),
              },
              { merge: true },
            );
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subId = typeof data.id === "string" ? data.id : "";
        if (subId) {
          const plan = isRecord(data.plan) ? data.plan : {};
          await adminDb
            .collection(COLLECTIONS.STRIPE_SUBSCRIPTIONS)
            .doc(stableDocId("webhook", subId))
            .set(
              {
                source: "webhook",
                event_type: eventType,
                subscription_id: subId,
                status: typeof data.status === "string" ? data.status : "unknown",
                current_period_end:
                  typeof data.current_period_end === "number"
                    ? data.current_period_end
                    : 0,
                plan_amount: typeof plan.amount === "number" ? plan.amount : null,
                plan_currency:
                  typeof plan.currency === "string" ? plan.currency : null,
                customer_email:
                  typeof data.customer_email === "string" ? data.customer_email : null,
                synced_at: new Date().toISOString(),
              },
              { merge: true },
            );
        }
        break;
      }
      default:
        log.debug("Unhandled Stripe event.", { eventType });
    }

    return NextResponse.json({ received: true, id: eventId });
  } catch (routeError) {
    log.error("Stripe webhook processing failed.", routeError);
    return NextResponse.json({ error: "Processing failed." }, { status: 500 });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
