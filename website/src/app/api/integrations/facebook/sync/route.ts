import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { decrypt } from "@/lib/utils/encryption";
import { runFullSync } from "@/lib/integrations/facebook/sync";
import { getUserPages } from "@/lib/integrations/facebook/client";
import { getFacebookSchemaHealth } from "@/lib/integrations/schema-health";
import { createServerLogger } from "@/lib/server-logger";

const FACEBOOK_SCHEMA_MISSING = "FACEBOOK_SCHEMA_MISSING";
const log = createServerLogger("FacebookSyncApi");

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

function isExpiredTokenError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("190") ||
    normalized.includes("oauthexception") ||
    normalized.includes("invalid")
  );
}

async function markFacebookIntegrationsErrored(userId: string) {
  try {
    const integrationSnapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATIONS)
      .where("user_id", "==", userId)
      .where("provider", "==", "facebook")
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
    log.warn("Failed to mark Facebook integrations as errored:", error);
  }
}

async function updateIntegrationStatus(integrationId: string, status: string) {
  try {
    await adminDb
      .collection(COLLECTIONS.INTEGRATIONS)
      .doc(integrationId)
      .update({ status });
  } catch (error) {
    log.warn("Failed to update Facebook integration status:", error);
  }
}

async function updateFacebookSyncJobs(
  integrationId: string,
  patch: Record<string, unknown>
) {
  try {
    const syncJobSnapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATION_SYNC_JOBS)
      .where("integration_id", "==", integrationId)
      .where("provider", "==", "facebook")
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
    log.warn("Failed to update Facebook sync jobs:", error);
  }
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireAuth(request);
  if (error) {
    return error;
  }

  try {
    const schemaHealth = await getFacebookSchemaHealth(adminDb);

    if (!schemaHealth.ok) {
      const message = `Missing required Facebook tables: ${schemaHealth.missingTables.join(", ")}`;
      await markFacebookIntegrationsErrored(user.uid);

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
      if (
        typeof integration.access_token_enc !== "string" ||
        typeof integration.token_iv !== "string"
      ) {
        const message = "Facebook integration needs to be reconnected";
        await updateIntegrationStatus(integrationId, "expired");
        await updateFacebookSyncJobs(integrationId, {
          status: "failed",
          last_error: message,
          next_retry_at: null,
        });

        return NextResponse.json(
          { error: message },
          { status: 409 }
        );
      }

      const accessToken = decrypt(
        integration.access_token_enc,
        integration.token_iv
      );

      const config = {
        accessToken,
        tokenExpiresAt: getTokenExpiresAt(integration.token_expires_at),
      };

      const pages = await getUserPages(config);
      if (pages.length === 0) {
        const message = "No Facebook Pages found for this account";
        await updateFacebookSyncJobs(integrationId, {
          status: "failed",
          last_error: message,
          next_retry_at: null,
        });

        return NextResponse.json(
          { error: message },
          { status: 409 }
        );
      }

      const result = await runFullSync(
        adminDb,
        user.uid,
        integrationId,
        config,
        pages
      );

      await updateFacebookSyncJobs(integrationId, {
        status: "succeeded",
        next_retry_at: null,
        last_error: null,
      });

      return NextResponse.json({ success: true, synced: result });
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      const message = "Sync failed";
      log.error("Facebook sync error:", error);

      if (isExpiredTokenError(errorMessage)) {
        await updateIntegrationStatus(integrationId, "expired");
      }

      await updateFacebookSyncJobs(integrationId, {
        status: "failed",
        last_error: message,
        next_retry_at: null,
      });

      return NextResponse.json({ error: message }, { status: 500 });
    }
  } catch (error) {
    log.error("Facebook sync route error:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
