import { NextResponse, type NextRequest } from "next/server";
import type { DocumentData, QuerySnapshot } from "firebase-admin/firestore";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";

async function deleteSnapshotInChunks(
  snapshot: QuerySnapshot<DocumentData>
) {
  for (let index = 0; index < snapshot.docs.length; index += 400) {
    const batch = adminDb.batch();
    const chunk = snapshot.docs.slice(index, index + 400);
    chunk.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}

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
    console.error("Razorpay disconnect error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? "Failed to disconnect Razorpay."
            : "Failed to disconnect Razorpay.",
      },
      { status: 500 }
    );
  }
}
