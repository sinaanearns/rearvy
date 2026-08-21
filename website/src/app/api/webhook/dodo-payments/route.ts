import { Webhooks } from "@dodopayments/nextjs";
import { adminDb } from "@/lib/firebase/admin";
import { createServerLogger } from "@/lib/server-logger";
import { type NextRequest, NextResponse } from "next/server";

const log = createServerLogger("DodoWebhook");

type Plan = "free" | "pro" | "business";

async function setUserPlan(userId: string, plan: Plan) {
  await adminDb.collection("profiles").doc(userId).set(
    {
      plan,
      updated_at: new Date(),
    },
    { merge: true }
  );
}

function readUserIdFromPayload(payload: any): string | null {
  // Prefer explicit metadata we set at checkout session creation
  const meta = payload?.data?.metadata || payload?.data?.subscription?.metadata || null;
  if (meta && typeof meta.firebase_user_id === "string" && meta.firebase_user_id.trim()) {
    return meta.firebase_user_id.trim();
  }
  return null;
}

// Defer handler construction to runtime so the missing env var does not crash
// the Next.js build during static page-data collection.
function getHandler() {
  const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_SECRET;
  if (!webhookKey) {
    throw new Error(
      "DODO_PAYMENTS_WEBHOOK_SECRET environment variable is not set. " +
        "Add it in your Vercel project settings under Environment Variables."
    );
  }

  return Webhooks({
    webhookKey,
    onPayload: async (payload) => {
      log.info("Webhook received", {
        type: (payload as any)?.type || "unknown",
        id: (payload as any)?.id || "no-id",
      });
    },
    onSubscriptionActive: async (payload) => {
      const userId = readUserIdFromPayload(payload);
      if (!userId) {
        log.warn("subscription.active: missing firebase_user_id in metadata");
        return;
      }
      await setUserPlan(userId, "business");
      log.info("Upgraded user to business", { userId, event: "subscription.active" });
    },
    onSubscriptionRenewed: async (payload) => {
      const userId = readUserIdFromPayload(payload);
      if (!userId) return;
      await setUserPlan(userId, "business");
      log.info("Ensured user remains business", { userId, event: "subscription.renewed" });
    },
    onSubscriptionPlanChanged: async (payload) => {
      const userId = readUserIdFromPayload(payload);
      if (!userId) return;
      await setUserPlan(userId, "business");
      log.info("Refreshed user plan to business", { userId, event: "subscription.plan_changed" });
    },
    onSubscriptionCancelled: async (payload) => {
      const userId = readUserIdFromPayload(payload);
      if (!userId) return;
      await setUserPlan(userId, "free");
      log.info("Downgraded user to free", { userId, event: "subscription.cancelled" });
    },
    onSubscriptionExpired: async (payload) => {
      const userId = readUserIdFromPayload(payload);
      if (!userId) return;
      await setUserPlan(userId, "free");
      log.info("Downgraded user to free", { userId, event: "subscription.expired" });
    },
    onSubscriptionOnHold: async (payload) => {
      const userId = readUserIdFromPayload(payload);
      log.info("Subscription on hold", { userId: userId ?? "unknown" });
    },
    onPaymentSucceeded: async (_payload) => {
      // Optional: attach reconciliation logic if needed
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const handler = getHandler();
    return handler(request);
  } catch (err: any) {
    log.error("DodoPayments webhook misconfigured", { message: err?.message });
    return NextResponse.json(
      { error: "Webhook endpoint not configured." },
      { status: 500 }
    );
  }
}