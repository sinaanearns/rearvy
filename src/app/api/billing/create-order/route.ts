import { NextRequest, NextResponse } from "next/server";
import { createProCheckoutOrder, isProBillingConfigured } from "@/lib/billing/server";
import type { CreateProCheckoutRequest } from "@/lib/billing/shared";
import { getUserFromRequest } from "@/lib/firebase/server";
import { handleApiError } from "@/lib/api-error";

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

    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as CreateProCheckoutRequest;
    const source = body.source === "settings" ? "settings" : "signup";

    if (body.email && body.email.trim().toLowerCase() !== (data.user.email || "").trim().toLowerCase()) {
      return NextResponse.json(
        { error: "Email must match the authenticated user" },
        { status: 403 }
      );
    }

    const order = await createProCheckoutOrder({
      email: data.user.email || null,
      fullName: typeof body.fullName === "string" ? body.fullName : null,
      source,
    });

    return NextResponse.json({
      provider: "razorpay",
      plan: "pro",
      ...order,
    });
  } catch (error) {
    return handleApiError(error, "POST /api/billing/create-order");
  }
}
