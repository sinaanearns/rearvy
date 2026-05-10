import { NextRequest, NextResponse } from "next/server";
import { verifyProCheckoutPayment } from "@/lib/billing/server";
import type { VerifyProCheckoutRequest } from "@/lib/billing/shared";
import { handleApiError } from "@/lib/api-error";
import { getUserFromRequest } from "@/lib/firebase/server";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as VerifyProCheckoutRequest;

    const verification = await verifyProCheckoutPayment({
      orderId: body.orderId,
      paymentId: body.paymentId,
      signature: body.signature,
    });

    // Ensure billing record belongs to authenticated user (by user_id or email)
    const billingRef = adminDb.collection("billing_payments").doc(verification.orderId);
    const billingSnap = await billingRef.get();
    if (billingSnap.exists) {
      const billing = billingSnap.data() as any;
      const billingUser = billing.user_id || null;
      const billingEmail = billing.email || null;

      if (billingUser && billingUser !== data.user.id) {
        return NextResponse.json({ error: "Payment belongs to a different account" }, { status: 403 });
      }

      if (billingEmail && data.user.email && billingEmail !== data.user.email) {
        return NextResponse.json({ error: "Payment does not match authenticated user email" }, { status: 403 });
      }
    }

    return NextResponse.json({
      provider: "razorpay",
      plan: "pro",
      ...verification,
    });
  } catch (error) {
    return handleApiError(error, "POST /api/billing/verify");
  }
}
