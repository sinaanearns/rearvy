import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";

export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const integrationSnapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATIONS)
      .where("user_id", "==", user.uid)
      .where("provider", "==", "gmail")
      .get();

    if (integrationSnapshot.empty) {
      return NextResponse.json(
        { error: "No Gmail integration found" },
        { status: 404 }
      );
    }

    const integrationIds = integrationSnapshot.docs.map((doc) => doc.id);
    const batch = adminDb.batch();

    integrationSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

    const threadsSnapshot = await adminDb
      .collection(COLLECTIONS.GMAIL_THREADS)
      .where("user_id", "==", user.uid)
      .get();
    threadsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

    const messagesSnapshot = await adminDb
      .collection(COLLECTIONS.GMAIL_MESSAGES)
      .where("user_id", "==", user.uid)
      .get();
    messagesSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

    for (const integrationId of integrationIds) {
      const syncJobsSnapshot = await adminDb
        .collection(COLLECTIONS.INTEGRATION_SYNC_JOBS)
        .where("integration_id", "==", integrationId)
        .where("provider", "==", "gmail")
        .get();
      syncJobsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
    }

    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Gmail disconnect error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Disconnect failed" },
      { status: 500 }
    );
  }
}
