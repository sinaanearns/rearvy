import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { decrypt } from "@/lib/utils/encryption";
import { runFullSync } from "@/lib/integrations/youtube/sync";
import { getYouTubeSchemaHealth } from "@/lib/integrations/schema-health";
import { runWhisperNetScanForUser } from "@/lib/whispernet/service";
import { createServerLogger } from "@/lib/server-logger";

const YOUTUBE_SCHEMA_MISSING = "YOUTUBE_SCHEMA_MISSING";
const log = createServerLogger("YouTubeSyncApi");

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "Sync failed");
}

function extractGoogleActivationUrl(message: string) {
  const match = message.match(/https:\/\/console\.developers\.google\.com\/[^\s"}]+/);
  return match?.[0] || null;
}

function isYouTubeApiDisabledError(message: string) {
  return (
    message.includes("youtube.googleapis.com") &&
    (message.includes("SERVICE_DISABLED") ||
      message.includes("accessNotConfigured") ||
      message.includes("API has not been used in project"))
  );
}

function getConfiguredGoogleProjectNumber() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) {
    return null;
  }

  const [projectNumber] = clientId.split("-", 1);
  return projectNumber && /^\d+$/.test(projectNumber) ? projectNumber : null;
}

function isExpiredTokenError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("401") ||
    normalized.includes("403") ||
    normalized.includes("invalid_grant")
  );
}

function getRefreshIv(integration: Record<string, unknown>) {
  const syncCursor = integration.sync_cursor;
  if (!syncCursor || typeof syncCursor !== "object" || Array.isArray(syncCursor)) {
    return "";
  }

  const refreshIv = (syncCursor as Record<string, unknown>).refresh_iv;
  return typeof refreshIv === "string" ? refreshIv : "";
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

async function markYouTubeIntegrationsErrored(userId: string) {
  try {
    const integrationsSnapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATIONS)
      .where("user_id", "==", userId)
      .where("provider", "==", "youtube")
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
    log.warn("Failed to mark YouTube integrations as errored:", error);
  }
}

async function updateIntegrationStatus(integrationId: string, status: string) {
  try {
    await adminDb
      .collection(COLLECTIONS.INTEGRATIONS)
      .doc(integrationId)
      .update({ status });
  } catch (error) {
    log.warn("Failed to update YouTube integration status:", error);
  }
}

async function updateYouTubeSyncJobs(
  integrationId: string,
  patch: Record<string, unknown>
) {
  try {
    const syncJobsSnapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATION_SYNC_JOBS)
      .where("integration_id", "==", integrationId)
      .where("provider", "==", "youtube")
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
    log.warn("Failed to update YouTube sync jobs:", error);
  }
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const schemaHealth = await getYouTubeSchemaHealth(adminDb);

    if (!schemaHealth.ok) {
      const message = `Missing required YouTube tables: ${schemaHealth.missingTables.join(", ")}`;
      await markYouTubeIntegrationsErrored(user.uid);

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
      if (
        typeof integration.access_token_enc !== "string" ||
        typeof integration.token_iv !== "string"
      ) {
        return NextResponse.json(
          { error: "YouTube integration needs to be reconnected" },
          { status: 409 }
        );
      }

      const refreshIv = getRefreshIv(integration);
      if (typeof integration.refresh_token_enc !== "string" || !refreshIv) {
        return NextResponse.json(
          { error: "YouTube integration needs to be reconnected" },
          { status: 409 }
        );
      }

      const accessToken = decrypt(
        integration.access_token_enc,
        integration.token_iv
      );
      const refreshToken = decrypt(integration.refresh_token_enc, refreshIv);

      const result = await runFullSync(adminDb, user.uid, integrationId, {
        accessToken,
        refreshToken,
        tokenExpiresAt: getTokenExpiresAt(integration.token_expires_at),
      });

      await updateYouTubeSyncJobs(integrationId, {
        status: "succeeded",
        next_retry_at: null,
        last_error: null,
      });

      let whispernet = null;
      try {
        whispernet = await runWhisperNetScanForUser(adminDb, user.uid, "sync");
      } catch (whispernetError) {
        log.warn("WhisperNet post-sync scan failed for YouTube:", whispernetError);
      }

      return NextResponse.json({ success: true, synced: result, whispernet });
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      const message = "Sync failed";
      log.error("YouTube sync error:", error);
      const youtubeApiDisabled = isYouTubeApiDisabledError(errorMessage);
      const activationUrl = extractGoogleActivationUrl(errorMessage);

      // Mark integration as expired if token is invalid
      if (isExpiredTokenError(errorMessage)) {
        await updateIntegrationStatus(integrationId, "expired");
      } else if (errorMessage.includes(YOUTUBE_SCHEMA_MISSING)) {
        await updateIntegrationStatus(integrationId, "error");
      }

      await updateYouTubeSyncJobs(integrationId, {
        status: "failed",
        last_error: message,
        next_retry_at: null,
      });

      if (youtubeApiDisabled) {
        return NextResponse.json(
          {
            error:
              "YouTube Data API v3 is disabled for the Google Cloud project used by this app. Enable YouTube Data API v3 in Google Cloud Console, wait a few minutes, then retry sync.",
            errorCode: "YOUTUBE_API_DISABLED",
            activationUrl,
            details: errorMessage,
            configuredGoogleProjectNumber: getConfiguredGoogleProjectNumber(),
          },
          { status: 503 }
        );
      }

      return NextResponse.json({ error: message }, { status: 500 });
    }
  } catch (error) {
    log.error("YouTube sync route error:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
