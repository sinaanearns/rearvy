import { NextRequest, NextResponse } from "next/server";
import { verifyProCheckoutPayment } from "@/lib/billing/server";
import type { VerifyProCheckoutRequest } from "@/lib/billing/shared";

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
    console.error("Error verifying billing payment:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to verify the payment.",
      },
      { status: 400 }
    );
  }
}
