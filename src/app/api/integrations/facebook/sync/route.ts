import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { decrypt } from "@/lib/utils/encryption";
import { runFullSync } from "@/lib/integrations/facebook/sync";
import { getUserPages } from "@/lib/integrations/facebook/client";
import { getFacebookSchemaHealth } from "@/lib/integrations/schema-health";

const FACEBOOK_SCHEMA_MISSING = "FACEBOOK_SCHEMA_MISSING";

export async function POST(request: NextRequest) {
  const { user, error } = await requireAuth(request);
  if (error) {
    return error;
  }

  const schemaHealth = await getFacebookSchemaHealth(adminDb);

  if (!schemaHealth.ok) {
    const message = `Missing required Facebook tables: ${schemaHealth.missingTables.join(", ")}`;
    const integrationSnapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATIONS)
      .where("user_id", "==", user.uid)
      .where("provider", "==", "facebook")
      .get();

    if (!integrationSnapshot.empty) {
      integrationSnapshot.docs.forEach((doc) => {
        doc.ref.update({ status: "error" });
      });
    }

    return NextResponse.json(
      {
        error: message,
        errorCode: FACEBOOK_SCHEMA_MISSING,
        missingTables: schemaHealth.missingTables,
      },
      { status: 503 }
    );
  }

  const integrationSnapshot = await adminDb
    .collection(COLLECTIONS.INTEGRATIONS)
    .where("user_id", "==", user.uid)
    .where("provider", "==", "facebook")
    .where("status", "==", "active")
    .get();

  if (integrationSnapshot.empty) {
    return NextResponse.json(
      { error: "No active Facebook integration found" },
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

    const config = {
      accessToken,
      tokenExpiresAt: new Date(integration.token_expires_at || 0),
    };

    // Get pages to sync
    const pages = await getUserPages(config);

    const result = await runFullSync(adminDb, user.uid, integrationId, config, pages);

    const syncJobSnapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATION_SYNC_JOBS)
      .where("integration_id", "==", integrationId)
      .where("provider", "==", "facebook")
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

    return NextResponse.json({ success: true, synced: result });
  } catch (error: unknown) {
    const message = "Sync failed";
    console.error("Facebook sync error:", error);

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
      .where("provider", "==", "facebook")
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
