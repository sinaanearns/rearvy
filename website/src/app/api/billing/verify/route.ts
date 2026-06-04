import { NextRequest, NextResponse } from "next/server";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import { recordMetaMaskProPayment, verifyProCheckoutPayment } from "@/lib/billing/server";
import { handleApiError } from "@/lib/api-error";
import { getUserFromRequest } from "@/lib/firebase/server";
import { adminDb } from "@/lib/firebase/admin";
import { normalizePaidBillingPlan } from "@/lib/billing/shared";

export const runtime = "nodejs";

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export async function POST(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await readJsonRecord(request);

    if (body.provider === "metamask") {
      const verification = await recordMetaMaskProPayment({
        plan: normalizePaidBillingPlan(body.plan),
        transactionHash: optionalString(body.transactionHash) || "",
        fromAddress: optionalString(body.fromAddress) || "",
        toAddress: optionalString(body.toAddress) || "",
        valueWei: optionalString(body.valueWei) || "",
        chainId: optionalString(body.chainId),
        userId: data.user.id,
        email: data.user.email,
      });

      return NextResponse.json({
        provider: "metamask",
        ...verification,
      });
    }

    const verification = await verifyProCheckoutPayment({
      orderId: optionalString(body.orderId) || "",
      paymentId: optionalString(body.paymentId) || "",
      signature: optionalString(body.signature) || "",
    });

    const billingRef = adminDb.collection("billing_payments").doc(verification.orderId);
    const billingSnap = await billingRef.get();
    if (billingSnap.exists) {
      const billing = billingSnap.data() as Record<string, unknown> | undefined;
      const billingUser = optionalString(billing?.user_id);
      const billingEmail = optionalString(billing?.email);

      if (billingUser && billingUser !== data.user.id) {
        return NextResponse.json({ error: "Payment belongs to a different account" }, { status: 403 });
      }

      if (billingEmail && data.user.email && billingEmail !== data.user.email) {
        return NextResponse.json({ error: "Payment does not match authenticated user email" }, { status: 403 });
      }
    }

    return NextResponse.json({
      provider: "razorpay",
      ...verification,
    });
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return handleApiError(error, "POST /api/billing/verify");
  }
}
