import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { enqueueSyncJob, triggerSyncWorker } from "@/lib/integrations/sync-jobs";

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;

    const { shopDomain } = await request.json();
    if (!shopDomain) {
      return NextResponse.json({ error: "Missing shopDomain" }, { status: 400 });
    }

    const pendingId = `pending_${shopDomain}`;
    const pendingRef = adminDb.collection(COLLECTIONS.INTEGRATIONS).doc(pendingId);
    const pendingSnap = await pendingRef.get();

    if (!pendingSnap.exists) {
      // Check if it's already claimed or doesn't exist
      const existing = await adminDb
        .collection(COLLECTIONS.INTEGRATIONS)
        .where("user_id", "==", user.uid)
        .where("sync_cursor.shop_domain", "==", shopDomain)
        .limit(1)
        .get();

      if (!existing.empty) {
        return NextResponse.json({ success: true, message: "Already claimed" });
      }

      return NextResponse.json({ error: "Pending connection not found" }, { status: 404 });
    }

    const data = pendingSnap.data();
    if (!data) return NextResponse.json({ error: "Invalid data" }, { status: 500 });

    // 1. Create the permanent integration record
    const integrationData = {
      ...data,
      user_id: user.uid,
      status: "active",
      updated_at: new Date(),
    };

    const newDocRef = await adminDb.collection(COLLECTIONS.INTEGRATIONS).add(integrationData);

    // 2. Delete the pending record
    await pendingRef.delete();

    // 3. Queue initial sync
    await enqueueSyncJob(adminDb, {
      userId: user.uid,
      integrationId: newDocRef.id,
      provider: "shopify",
    });
    void triggerSyncWorker("shopify");

    console.log(`[Shopify Claim] Store ${shopDomain} successfully claimed by user ${user.uid}`);

    return NextResponse.json({ 
      success: true, 
      integrationId: newDocRef.id 
    });
  } catch (error) {
    console.error("[Shopify Claim] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
