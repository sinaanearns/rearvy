import { NextRequest, NextResponse } from "next/server";
import { verifyProCheckoutPayment } from "@/lib/billing/server";
import type { VerifyProCheckoutRequest } from "@/lib/billing/shared";
import { handleApiError } from "@/lib/api-error";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as VerifyProCheckoutRequest;

    const verification = await verifyProCheckoutPayment({
      orderId: body.orderId,
      paymentId: body.paymentId,
      signature: body.signature,
    });

    return NextResponse.json({
      provider: "razorpay",
      plan: "pro",
      ...verification,
    });
  } catch (error) {
    return handleApiError(error, "POST /api/billing/verify");
  }
}
