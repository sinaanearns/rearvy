import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { deleteSnapshotInChunks } from "@/lib/integrations/disconnect";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("RazorpayDisconnectApi");

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const integrationSnapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATIONS)
      .where("user_id", "==", user.uid)
      .where("provider", "==", "razorpay")
      .limit(1)
      .get();

    if (integrationSnapshot.empty) {
      return NextResponse.json(
        { error: "No Razorpay integration found" },
        { status: 404 }
      );
    }

    const integrationDoc = integrationSnapshot.docs[0];
    const integrationId = integrationDoc.id;

    const [paymentsSnapshot, syncJobsSnapshot] = await Promise.all([
      adminDb
        .collection(COLLECTIONS.RAZORPAY_PAYMENTS)
        .where("user_id", "==", user.uid)
        .where("integration_id", "==", integrationId)
        .get(),
      adminDb
        .collection(COLLECTIONS.INTEGRATION_SYNC_JOBS)
        .where("integration_id", "==", integrationId)
        .where("provider", "==", "razorpay")
        .get(),
    ]);

    await deleteSnapshotInChunks(paymentsSnapshot);
    await deleteSnapshotInChunks(syncJobsSnapshot);
    await integrationDoc.ref.delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Razorpay disconnect error:", error);
    return NextResponse.json(
      { error: "Failed to disconnect Razorpay." },
      { status: 500 }
    );
  }
}
