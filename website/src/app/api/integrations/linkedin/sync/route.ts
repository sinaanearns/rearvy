import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { decrypt } from "@/lib/utils/encryption";
import { runFullSync } from "@/lib/integrations/linkedin/sync";
import { getLinkedInSchemaHealth } from "@/lib/integrations/schema-health";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("LinkedInSyncApi");

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "Sync failed");
}

function isExpiredTokenError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("401") ||
    normalized.includes("403") ||
    normalized.includes("invalid_grant")
  );
}

async function markLinkedInIntegrationsErrored(userId: string) {
  try {
    const integrationsSnapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATIONS)
      .where("user_id", "==", userId)
      .where("provider", "==", "linkedin")
      .get();

    if (integrationsSnapshot.empty) {
      return;
    }

    const batch = adminDb.batch();
    integrationsSnapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { status: "error" });
    });
    await batch.commit();
  } catch (error) {
    log.warn("Failed to mark LinkedIn integrations as errored:", error);
  }
}

async function updateIntegrationStatus(integrationId: string, status: string) {
  try {
    await adminDb
      .collection(COLLECTIONS.INTEGRATIONS)
      .doc(integrationId)
      .update({ status });
  } catch (error) {
    log.warn("Failed to update LinkedIn integration status:", error);
  }
}

async function updateLinkedInSyncJobs(
  integrationId: string,
  patch: Record<string, unknown>
) {
  try {
    const syncJobsSnapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATION_SYNC_JOBS)
      .where("integration_id", "==", integrationId)
      .where("provider", "==", "linkedin")
      .get();

    if (syncJobsSnapshot.empty) {
      return;
    }

    const batch = adminDb.batch();
    syncJobsSnapshot.docs.forEach((doc) => {
      batch.update(doc.ref, patch);
    });
    await batch.commit();
  } catch (error) {
    log.warn("Failed to update LinkedIn sync jobs:", error);
  }
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const schemaHealth = await getLinkedInSchemaHealth(adminDb);

    if (!schemaHealth.ok) {
      const message = `Missing required LinkedIn tables: ${schemaHealth.missingTables.join(", ")}`;
      await markLinkedInIntegrationsErrored(user.uid);

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
      if (
        typeof integration.access_token_enc !== "string" ||
        typeof integration.token_iv !== "string"
      ) {
        return NextResponse.json(
          { error: "LinkedIn integration needs to be reconnected" },
          { status: 409 }
        );
      }

      const accessToken = decrypt(
        integration.access_token_enc,
        integration.token_iv
      );

      const result = await runFullSync(adminDb, user.uid, integrationId, {
        accessToken,
      });

      await updateLinkedInSyncJobs(integrationId, {
        status: "succeeded",
        next_retry_at: null,
        last_error: null,
      });

      return NextResponse.json({ success: true, synced: result });
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      const message = "Sync failed";
      log.error("LinkedIn sync error:", error);

      // Mark integration as expired if token is invalid
      if (isExpiredTokenError(errorMessage)) {
        await updateIntegrationStatus(integrationId, "expired");
      }

      await updateLinkedInSyncJobs(integrationId, {
        status: "failed",
        last_error: message,
        next_retry_at: null,
      });

      return NextResponse.json({ error: message }, { status: 500 });
    }
  } catch (error) {
    log.error("LinkedIn sync route error:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
