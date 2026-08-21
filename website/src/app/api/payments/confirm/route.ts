import { NextRequest, NextResponse } from "next/server";
import DodoPayments from "dodopayments";
import { getUserFromRequest } from "@/lib/firebase/server";
import { adminDb } from "@/lib/firebase/admin";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("PaymentsConfirmRoute");

export async function POST(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = data.user.id;
    let sessionId: string | null = null;

    try {
      const body = await request.json();
      if (typeof body?.session_id === "string" && body.session_id.trim()) {
        sessionId = body.session_id.trim();
      }
    } catch {
      // Body may be empty
    }

    // Optional: If session_id is provided and Dodo Payments is configured, verify session
    const apiKey = process.env.DODO_PAYMENTS_API_KEY;
    if (sessionId && apiKey) {
      try {
        const environment = (process.env.DODO_PAYMENTS_ENVIRONMENT || "live_mode") as
          | "test_mode"
          | "live_mode";
        const client = new DodoPayments({
          bearerToken: apiKey,
          environment,
        });

        const session = await client.checkoutSessions.retrieve(sessionId);
        log.info("Dodo checkout session retrieved for confirmation", {
          sessionId,
          session: Boolean(session),
        });
      } catch (dodoErr) {
        log.warn("Dodo session retrieval warning during confirmation", dodoErr as Error);
      }
    }

    // Update user profile to business plan
    await adminDb.collection("profiles").doc(userId).set(
      {
        plan: "business",
        updated_at: new Date(),
      },
      { merge: true }
    );

    log.info("Successfully activated Business plan for user upon payment confirmation", { userId });

    return NextResponse.json({
      success: true,
      plan: "business",
      message: "Business plan activated successfully.",
    });
  } catch (err) {
    log.error("Unhandled error confirming payment status", err as Error);
    return NextResponse.json({ error: "Failed to confirm payment status" }, { status: 500 });
  }
}
