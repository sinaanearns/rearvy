import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import {
  buildRazorpayEnvIntegrationData,
  isRazorpayCollectionsConfigured,
} from "@/lib/integrations/razorpay/sync";
import { enqueueSyncJob, triggerSyncWorker } from "@/lib/integrations/sync-jobs";

export const runtime = "nodejs";

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

  try {
    const integrationData = buildRazorpayEnvIntegrationData(user.uid);
    const existingSnapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATIONS)
      .where("user_id", "==", user.uid)
      .where("provider", "==", "razorpay")
      .limit(1)
      .get();

    let integrationId: string;
    if (!existingSnapshot.empty) {
      const existingDoc = existingSnapshot.docs[0];
      await existingDoc.ref.set(integrationData, { merge: true });
      integrationId = existingDoc.id;
    } else {
      const integrationRef = await adminDb.collection(COLLECTIONS.INTEGRATIONS).add({
        ...integrationData,
        created_at: new Date().toISOString(),
      });
      integrationId = integrationRef.id;
    }

    await enqueueSyncJob(adminDb, {
      userId: user.uid,
      integrationId,
      provider: "razorpay",
    });
    void triggerSyncWorker("razorpay");

    return NextResponse.json({
      success: true,
      integrationId,
      message: "Razorpay connected successfully. Data sync is starting now.",
    });
  } catch (error) {
    console.error("Razorpay connect error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to connect Razorpay.",
      },
      { status: 500 }
    );
  }
}
