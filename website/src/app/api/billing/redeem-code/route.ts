import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/firebase/server";
import { adminDb } from "@/lib/firebase/admin";
import { createServerLogger } from "@/lib/server-logger";
import type { SubscriptionPlan } from "@/lib/plans";

const log = createServerLogger("RedeemCodeApi");

const VALID_CODES: Record<string, SubscriptionPlan> = {
  BUSINESS: "business",
  PRO: "pro",
  REARVYBUSINESS: "business",
  REARVYPRO: "pro",
  BUSINESS2026: "business",
  PRO2026: "pro",
  VIP: "business",
  ENTERPRISE: "business",
};

export async function POST(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const rawCode = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";

    if (!rawCode) {
      return NextResponse.json({ error: "Redeem code is required." }, { status: 400 });
    }

    const planToActivate = VALID_CODES[rawCode];
    if (!planToActivate) {
      return NextResponse.json(
        { error: "Invalid or expired redeem code." },
        { status: 400 }
      );
    }

    const userId = data.user.id;
    await adminDb.collection("profiles").doc(userId).set(
      {
        plan: planToActivate,
        updated_at: new Date(),
      },
      { merge: true }
    );

    log.info("Redeem code applied successfully", { userId, code: rawCode, plan: planToActivate });

    return NextResponse.json({
      success: true,
      plan: planToActivate,
      message: `Code redeemed! You are now on the ${planToActivate === "business" ? "Business Access" : "Pro Access"} plan.`,
    });
  } catch (err) {
    log.error("Error applying redeem code:", err);
    return NextResponse.json({ error: "Failed to redeem code." }, { status: 500 });
  }
}
