import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { decrypt } from "@/lib/utils/encryption";
import { runFullSync } from "@/lib/integrations/instagram/sync";
import { getInstagramSchemaHealth } from "@/lib/integrations/schema-health";
import { runWhisperNetScanForUser } from "@/lib/whispernet/service";

const INSTAGRAM_SCHEMA_MISSING = "INSTAGRAM_SCHEMA_MISSING";

export async function POST(request: NextRequest) {
  const { user, error } = await requireAuth(request);
  if (error) {
    return error;
  }

  const schemaHealth = await getInstagramSchemaHealth(adminDb);

  if (!schemaHealth.ok) {
    const message = `Missing required Instagram tables: ${schemaHealth.missingTables.join(", ")}`;
    const integrationSnapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATIONS)
      .where("user_id", "==", user.uid)
      .where("provider", "==", "instagram")
      .get();

    if (!integrationSnapshot.empty) {
      integrationSnapshot.docs.forEach((doc) => {
        doc.ref.update({ status: "error" });
      });
    }

    return NextResponse.json(
      {
        error: message,
        errorCode: INSTAGRAM_SCHEMA_MISSING,
        missingTables: schemaHealth.missingTables,
      },
      { status: 503 }
    );
  }

  const integrationSnapshot = await adminDb
    .collection(COLLECTIONS.INTEGRATIONS)
    .where("user_id", "==", user.uid)
    .where("provider", "==", "instagram")
    .where("status", "==", "active")
    .get();

  if (integrationSnapshot.empty) {
    return NextResponse.json(
      { error: "No active Instagram integration found" },
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

    const igUserId = (
      integration.sync_cursor as { ig_user_id?: string } | null
    )?.ig_user_id;

    if (!igUserId) {
      throw new Error("Missing Instagram user ID in sync cursor");
    }

    const result = await runFullSync(adminDb, user.uid, integrationId, {
      accessToken,
      tokenExpiresAt: new Date(integration.token_expires_at || 0),
    }, igUserId);

    const syncJobSnapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATION_SYNC_JOBS)
      .where("integration_id", "==", integrationId)
      .where("provider", "==", "instagram")
      .get();

    if (!syncJobSnapshot.empty) {
      syncJobSnapshot.docs.forEach((doc) => {
        doc.ref.update({
          status: "succeeded",
          next_retry_at: null,
          last_error: null,
        });
      });
    }

    let whispernet = null;
    try {
      whispernet = await runWhisperNetScanForUser(adminDb, user.uid, "sync");
    } catch (whispernetError) {
      console.error("WhisperNet post-sync scan failed for Instagram:", whispernetError);
    }

    return NextResponse.json({ success: true, synced: result, whispernet });
  } catch (error: unknown) {
    const message = "Sync failed";
    console.error("Instagram sync error:", error);

    if (
      message.includes("190") ||
      message.includes("OAuthException") ||
      message.includes("invalid")
    ) {
      await adminDb
        .collection(COLLECTIONS.INTEGRATIONS)
        .doc(integrationId)
        .update({ status: "expired" });
    }

    const syncJobSnapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATION_SYNC_JOBS)
      .where("integration_id", "==", integrationId)
      .where("provider", "==", "instagram")
      .get();

    if (!syncJobSnapshot.empty) {
      syncJobSnapshot.docs.forEach((doc) => {
        doc.ref.update({
          status: "failed",
          last_error: message,
          next_retry_at: null,
        });
      });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
