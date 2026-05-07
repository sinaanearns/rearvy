import { NextRequest, NextResponse } from "next/server";
import { createProCheckoutOrder, isProBillingConfigured } from "@/lib/billing/server";
import type { CreateProCheckoutRequest } from "@/lib/billing/shared";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    if (!isProBillingConfigured()) {
      return NextResponse.json(
        {
          error:
            "Pro billing is not configured yet. Add the Razorpay billing environment variables first.",
        },
        { status: 503 }
      );
    }

    const body = (await request.json()) as CreateProCheckoutRequest;
    const source = body.source === "settings" ? "settings" : "signup";

    const order = await createProCheckoutOrder({
      email: typeof body.email === "string" ? body.email : null,
      fullName: typeof body.fullName === "string" ? body.fullName : null,
      source,
    });

    return NextResponse.json({
      provider: "razorpay",
      plan: "pro",
      ...order,
    });
  } catch (error) {
    console.error("Error creating billing order:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create the billing order.",
      },
      { status: 500 }
    );
  }
}
