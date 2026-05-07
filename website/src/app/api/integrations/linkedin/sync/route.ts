import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { decrypt } from "@/lib/utils/encryption";
import { runFullSync } from "@/lib/integrations/linkedin/sync";
import { getLinkedInSchemaHealth } from "@/lib/integrations/schema-health";

export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;

  const schemaHealth = await getLinkedInSchemaHealth(adminDb);

  if (!schemaHealth.ok) {
    const message = `Missing required LinkedIn tables: ${schemaHealth.missingTables.join(", ")}`;
    const integrationsSnapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATIONS)
      .where("user_id", "==", user.uid)
      .where("provider", "==", "linkedin")
      .get();
    
    const batch = adminDb.batch();
    integrationsSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, { status: "error" });
    });
    await batch.commit();

    return NextResponse.json(
      {
        error: message,
        errorCode: "LINKEDIN_SCHEMA_MISSING",
        missingTables: schemaHealth.missingTables,
      },
      { status: 503 }
    );
  }

  const integrationSnapshot = await adminDb
    .collection(COLLECTIONS.INTEGRATIONS)
    .where("user_id", "==", user.uid)
    .where("provider", "==", "linkedin")
    .where("status", "==", "active")
    .get();

  if (integrationSnapshot.empty) {
    return NextResponse.json(
      { error: "No active LinkedIn integration found" },
      { status: 404 }
    );
  }

  const integrationDoc = integrationSnapshot.docs[0];
  const integration = integrationDoc.data();
  const integrationId = integrationDoc.id;

  try {
    const accessToken = decrypt(
      integration.access_token_enc,
      integration.token_iv
    );

    const result = await runFullSync(adminDb, user.uid, integrationId, {
      accessToken,
    });

    const syncJobsSnapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATION_SYNC_JOBS)
      .where("integration_id", "==", integrationId)
      .where("provider", "==", "linkedin")
      .get();
    
    const batch = adminDb.batch();
    syncJobsSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        status: "succeeded",
        next_retry_at: null,
        last_error: null,
      });
    });
    await batch.commit();

    return NextResponse.json({ success: true, synced: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Sync failed";
    console.error("LinkedIn sync error:", error);

    // Mark integration as expired if token is invalid
    if (
      message.includes("401") ||
      message.includes("403") ||
      message.includes("invalid_grant")
    ) {
      await adminDb
        .collection(COLLECTIONS.INTEGRATIONS)
        .doc(integrationId)
        .update({ status: "expired" });
    }

    const syncJobsSnapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATION_SYNC_JOBS)
      .where("integration_id", "==", integrationId)
      .where("provider", "==", "linkedin")
      .get();
    
    const batch = adminDb.batch();
    syncJobsSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        status: "failed",
        last_error: message,
        next_retry_at: null,
      });
    });
    await batch.commit();

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

