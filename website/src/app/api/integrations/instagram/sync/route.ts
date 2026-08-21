import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { decrypt } from "@/lib/utils/encryption";
import { runFullSync } from "@/lib/integrations/instagram/sync";
import { getInstagramSchemaHealth } from "@/lib/integrations/schema-health";
import { runWhisperNetScanForUser } from "@/lib/whispernet/service";
import { createServerLogger } from "@/lib/server-logger";

const INSTAGRAM_SCHEMA_MISSING = "INSTAGRAM_SCHEMA_MISSING";
const log = createServerLogger("InstagramSyncApi");

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "Sync failed");
}

function getTokenExpiresAt(value: unknown) {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date(0) : date;
  }

  if (value && typeof value === "object" && "toDate" in value) {
    const maybeTimestamp = value as { toDate?: () => unknown };
    const date = maybeTimestamp.toDate?.();
    if (date instanceof Date && !Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return new Date(0);
}

function getInstagramUserId(integration: Record<string, unknown>) {
  const syncCursor = integration.sync_cursor;
  if (!syncCursor || typeof syncCursor !== "object" || Array.isArray(syncCursor)) {
    return "";
  }

  const igUserId = (syncCursor as Record<string, unknown>).ig_user_id;
  return typeof igUserId === "string" ? igUserId : "";
}

function isExpiredTokenError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("190") ||
    normalized.includes("oauthexception") ||
    normalized.includes("invalid")
  );
}

async function markInstagramIntegrationsErrored(userId: string) {
  try {
    const integrationSnapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATIONS)
      .where("user_id", "==", userId)
      .where("provider", "==", "instagram")
      .get();

    if (integrationSnapshot.empty) {
      return;
    }

    const batch = adminDb.batch();
    integrationSnapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { status: "error" });
    });
    await batch.commit();
  } catch (error) {
    log.warn("Failed to mark Instagram integrations as errored:", error);
  }
}

async function updateIntegrationStatus(integrationId: string, status: string) {
  try {
    await adminDb
      .collection(COLLECTIONS.INTEGRATIONS)
      .doc(integrationId)
      .update({ status });
  } catch (error) {
    log.warn("Failed to update Instagram integration status:", error);
  }
}

async function updateInstagramSyncJobs(
  integrationId: string,
  patch: Record<string, unknown>
) {
  try {
    const syncJobSnapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATION_SYNC_JOBS)
      .where("integration_id", "==", integrationId)
      .where("provider", "==", "instagram")
      .get();

    if (syncJobSnapshot.empty) {
      return;
    }

    const batch = adminDb.batch();
    syncJobSnapshot.docs.forEach((doc) => {
      batch.update(doc.ref, patch);
    });
    await batch.commit();
  } catch (error) {
    log.warn("Failed to update Instagram sync jobs:", error);
  }
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireAuth(request);
  if (error) {
    return error;
  }

  try {
    const schemaHealth = await getInstagramSchemaHealth(adminDb);

    if (!schemaHealth.ok) {
      const message = `Missing required Instagram tables: ${schemaHealth.missingTables.join(", ")}`;
      await markInstagramIntegrationsErrored(user.uid);

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
      if (
        typeof integration.access_token_enc !== "string" ||
        typeof integration.token_iv !== "string"
      ) {
        return NextResponse.json(
          { error: "Instagram integration needs to be reconnected" },
          { status: 409 }
        );
      }

      const igUserId = getInstagramUserId(integration);
      if (!igUserId) {
        return NextResponse.json(
          { error: "Instagram integration needs to be reconnected" },
          { status: 409 }
        );
      }

      const accessToken = decrypt(
        integration.access_token_enc,
        integration.token_iv
      );

      const result = await runFullSync(
        adminDb,
        user.uid,
        integrationId,
        {
          accessToken,
          tokenExpiresAt: getTokenExpiresAt(integration.token_expires_at),
        },
        igUserId
      );

      await updateInstagramSyncJobs(integrationId, {
        status: "succeeded",
        next_retry_at: null,
        last_error: null,
      });

      let whispernet = null;
      try {
        whispernet = await runWhisperNetScanForUser(adminDb, user.uid, "sync");
      } catch (whispernetError) {
        log.warn("WhisperNet post-sync scan failed for Instagram:", whispernetError);
      }

      return NextResponse.json({ success: true, synced: result, whispernet });
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      const message = "Sync failed";
      log.error("Instagram sync error:", error);

      if (isExpiredTokenError(errorMessage)) {
        await updateIntegrationStatus(integrationId, "expired");
      }

      await updateInstagramSyncJobs(integrationId, {
        status: "failed",
        last_error: message,
        next_retry_at: null,
      });

      return NextResponse.json({ error: message }, { status: 500 });
    }
  } catch (error) {
    log.error("Instagram sync route error:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
