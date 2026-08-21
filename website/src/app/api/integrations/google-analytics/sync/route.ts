import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { decrypt } from "@/lib/utils/encryption";
import { runFullSync } from "@/lib/integrations/google-analytics/sync";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("GoogleAnalyticsSyncApi");

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "Sync failed");
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

function isExpiredTokenError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("401") ||
    normalized.includes("403") ||
    normalized.includes("invalid_grant")
  );
}

async function updateIntegrationStatus(integrationId: string, status: string) {
  try {
    await adminDb
      .collection(COLLECTIONS.INTEGRATIONS)
      .doc(integrationId)
      .update({ status });
  } catch (error) {
    log.warn("Failed to update Google Analytics integration status:", error);
  }
}

async function updateGoogleAnalyticsSyncJobs(
  integrationId: string,
  patch: Record<string, unknown>
) {
  try {
    const snapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATION_SYNC_JOBS)
      .where("integration_id", "==", integrationId)
      .where("provider", "==", "google_analytics")
      .get();

    if (snapshot.empty) {
      return;
    }

    const batch = adminDb.batch();
    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, patch);
    });
    await batch.commit();
  } catch (error) {
    log.warn("Failed to update Google Analytics sync jobs:", error);
  }
}

function extractGoogleActivationUrl(message: string) {
  const match = message.match(/https:\/\/console\.developers\.google\.com\/[^\s"}]+/);
  return match?.[0] || null;
}

function isGa4ApiDisabledError(message: string) {
  return (
    (message.includes("analyticsadmin.googleapis.com") ||
      message.includes("analyticsdata.googleapis.com")) &&
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

export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;

  let activeIntegrationId: string | null = null;

  try {
    const snapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATIONS)
      .where("user_id", "==", user.uid)
      .where("provider", "==", "google_analytics")
      .where("status", "==", "active")
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json(
        { error: "No active Google Analytics integration found" },
        { status: 404 }
      );
    }

    const doc = snapshot.docs[0];
    const integration = doc.data();
    const integrationId = doc.id;
    activeIntegrationId = integrationId;

    const refreshIv = getRefreshIv(integration);

    if (
      typeof integration.access_token_enc !== "string" ||
      typeof integration.token_iv !== "string" ||
      typeof integration.refresh_token_enc !== "string" ||
      !refreshIv
    ) {
      const message = "Google Analytics integration needs to be reconnected";
      await updateIntegrationStatus(integrationId, "expired");
      await updateGoogleAnalyticsSyncJobs(integrationId, {
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
    const refreshToken = decrypt(integration.refresh_token_enc, refreshIv);
    const tokenExpiresAt = getTokenExpiresAt(integration.token_expires_at);

    const result = await runFullSync(
      adminDb,
      user.uid,
      integrationId,
      {
        accessToken,
        refreshToken,
        tokenExpiresAt,
      }
    );

    await updateGoogleAnalyticsSyncJobs(integrationId, {
      status: "succeeded",
      next_retry_at: null,
      last_error: null,
    });

    return NextResponse.json({
      success: true,
      synced: result,
    });
  } catch (err) {
    log.error("GA4 sync error:", err);
    const message = getErrorMessage(err);
    const ga4ApiDisabled = isGa4ApiDisabledError(message);

    if (activeIntegrationId) {
      if (isExpiredTokenError(message)) {
        await updateIntegrationStatus(activeIntegrationId, "expired");
      }

      await updateGoogleAnalyticsSyncJobs(activeIntegrationId, {
        status: "failed",
        last_error: "Sync failed",
        next_retry_at: null,
      });
    }

    if (ga4ApiDisabled) {
      return NextResponse.json(
        {
          error:
            "Google Analytics API is disabled for the Google Cloud project used by this app. Enable Google Analytics Admin API and Google Analytics Data API in Google Cloud Console, wait a few minutes, then retry sync.",
          errorCode: "GA4_API_DISABLED",
          activationUrl: extractGoogleActivationUrl(message),
          details: message,
          configuredGoogleProjectNumber: getConfiguredGoogleProjectNumber(),
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
