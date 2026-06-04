import { NextResponse, type NextRequest } from "next/server";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { enqueueSyncJob, triggerSyncWorker } from "@/lib/integrations/sync-jobs";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("ShopifyClaim");

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;

    const body = await readJsonRecord(request);
    const shopDomain = optionalString(body.shopDomain);
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

    log.debug("Store successfully claimed", { shopDomain });

    return NextResponse.json({ 
      success: true, 
      integrationId: newDocRef.id 
    });
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    log.error("Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
