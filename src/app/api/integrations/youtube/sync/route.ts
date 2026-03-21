import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { decrypt } from "@/lib/utils/encryption";
import { runFullSync } from "@/lib/integrations/youtube/sync";
import { getYouTubeSchemaHealth } from "@/lib/integrations/schema-health";
import { runWhisperNetScanForUser } from "@/lib/whispernet/service";

const YOUTUBE_SCHEMA_MISSING = "YOUTUBE_SCHEMA_MISSING";

export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;

  const schemaHealth = await getYouTubeSchemaHealth(adminDb);

  if (!schemaHealth.ok) {
    const message = `Missing required YouTube tables: ${schemaHealth.missingTables.join(", ")}`;
    const integrationsSnapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATIONS)
      .where("user_id", "==", user.uid)
      .where("provider", "==", "youtube")
      .get();
    
    const batch = adminDb.batch();
    integrationsSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, { status: "error" });
    });
    await batch.commit();

    return NextResponse.json(
      {
        error: message,
        errorCode: YOUTUBE_SCHEMA_MISSING,
        missingTables: schemaHealth.missingTables,
      },
      { status: 503 }
    );
  }

  const integrationSnapshot = await adminDb
    .collection(COLLECTIONS.INTEGRATIONS)
    .where("user_id", "==", user.uid)
    .where("provider", "==", "youtube")
    .where("status", "==", "active")
    .get();

  if (integrationSnapshot.empty) {
    return NextResponse.json(
      { error: "No active YouTube integration found" },
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

    const refreshIv = (
      integration.sync_cursor as { refresh_iv?: string } | null
    )?.refresh_iv;

    if (!integration.refresh_token_enc || !refreshIv) {
      throw new Error("Missing refresh token data");
    }

    const refreshToken = decrypt(integration.refresh_token_enc, refreshIv);

    const result = await runFullSync(adminDb, user.uid, integrationId, {
      accessToken,
      refreshToken,
      tokenExpiresAt: new Date(integration.token_expires_at || 0),
    });

    const syncJobsSnapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATION_SYNC_JOBS)
      .where("integration_id", "==", integrationId)
      .where("provider", "==", "youtube")
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

    let whispernet = null;
    try {
      whispernet = await runWhisperNetScanForUser(adminDb, user.uid, "sync");
    } catch (whispernetError) {
      console.error("WhisperNet post-sync scan failed for YouTube:", whispernetError);
    }

    return NextResponse.json({ success: true, synced: result, whispernet });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Sync failed";
    console.error("YouTube sync error:", error);

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
    } else if (message.includes(YOUTUBE_SCHEMA_MISSING)) {
      await adminDb
        .collection(COLLECTIONS.INTEGRATIONS)
        .doc(integrationId)
        .update({ status: "error" });
    }

    const syncJobsSnapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATION_SYNC_JOBS)
      .where("integration_id", "==", integrationId)
      .where("provider", "==", "youtube")
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
