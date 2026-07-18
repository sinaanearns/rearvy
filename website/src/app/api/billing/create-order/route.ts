import { NextRequest, NextResponse } from "next/server";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import { createProCheckoutOrder, isProBillingConfigured } from "@/lib/billing/server";
import { handleApiError } from "@/lib/api-error";
import { getUserFromRequest } from "@/lib/firebase/server";

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

    const body = await readJsonRecord(request);
    const source = body.source === "settings" ? "settings" : "signup";
    const email = typeof body.email === "string" ? body.email : "";
    const fullName = typeof body.fullName === "string" ? body.fullName : null;

    if (email && email.trim().toLowerCase() !== (data.user.email || "").trim().toLowerCase()) {
      return NextResponse.json(
        { error: "Email must match the authenticated user" },
        { status: 403 }
      );
    }

    const order = await createProCheckoutOrder({
      email: data.user.email || null,
      fullName,
      source,
    });

    return NextResponse.json({
      plan: "pro",
      ...order,
      provider: "razorpay",
    });
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return handleApiError(error, "POST /api/billing/create-order");
  }
}
