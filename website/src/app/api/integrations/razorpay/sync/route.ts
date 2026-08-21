import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import {
  isRazorpayCollectionsConfigured,
  runFullSync,
} from "@/lib/integrations/razorpay/sync";
import { createServerLogger } from "@/lib/server-logger";

export const runtime = "nodejs";

const log = createServerLogger("RazorpaySyncApi");

export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;

  if (!isRazorpayCollectionsConfigured()) {
    return NextResponse.json(
      {
        error:
          "Razorpay collections are not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET first.",
      },
      { status: 503 }
    );
  }

  const integrationsRef = adminDb.collection(COLLECTIONS.INTEGRATIONS);
  const integrationQuery = await integrationsRef
    .where("user_id", "==", user.uid)
    .where("provider", "==", "razorpay")
    .limit(1)
    .get();

  if (integrationQuery.empty) {
    return NextResponse.json(
      { error: "No active Razorpay integration found" },
      { status: 404 }
    );
  }

  const integration = {
    id: integrationQuery.docs[0].id,
    ...integrationQuery.docs[0].data(),
  } as { id: string };

  try {
    const result = await runFullSync(adminDb, user.uid, integration.id);

    const syncJobQuery = await adminDb
      .collection(COLLECTIONS.INTEGRATION_SYNC_JOBS)
      .where("integration_id", "==", integration.id)
      .where("provider", "==", "razorpay")
      .limit(1)
      .get();

    if (!syncJobQuery.empty) {
      await syncJobQuery.docs[0].ref.update({
        status: "succeeded",
        next_retry_at: null,
        last_error: null,
      });
    }

    return NextResponse.json({ success: true, synced: result });
  } catch (error) {
    const message = "Razorpay sync failed";
    log.error("Razorpay sync error:", error);

    await integrationsRef.doc(integration.id).set(
      {
        status: "error",
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    );

    const syncJobQuery = await adminDb
      .collection(COLLECTIONS.INTEGRATION_SYNC_JOBS)
      .where("integration_id", "==", integration.id)
      .where("provider", "==", "razorpay")
      .limit(1)
      .get();

    if (!syncJobQuery.empty) {
      await syncJobQuery.docs[0].ref.update({
        status: "failed",
        last_error: message,
        next_retry_at: null,
      });
    }

    return NextResponse.json(
      { error: message },
      { status: message.includes("not configured") ? 503 : 500 }
    );
  }
}
