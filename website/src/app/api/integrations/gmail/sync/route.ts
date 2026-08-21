import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { decrypt } from "@/lib/utils/encryption";
import { runFullSync } from "@/lib/integrations/gmail/sync";
import { runGmailInsightPipeline } from "@/lib/insights/gmail-pipeline";
import { createServerLogger } from "@/lib/server-logger";

export const runtime = "nodejs";

const log = createServerLogger("GmailSyncApi");

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "Gmail sync failed");
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
      .set(
        {
          status,
          updated_at: new Date().toISOString(),
        },
        { merge: true }
      );
  } catch (error) {
    log.warn("Failed to update Gmail integration status:", error);
  }
}

async function updateGmailSyncJobs(
  integrationId: string,
  patch: Record<string, unknown>
) {
  try {
    const syncJobsSnapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATION_SYNC_JOBS)
      .where("integration_id", "==", integrationId)
      .where("provider", "==", "gmail")
      .get();

    if (syncJobsSnapshot.empty) {
      return;
    }

    const batch = adminDb.batch();
    syncJobsSnapshot.docs.forEach((job) => {
      batch.update(job.ref, patch);
    });
    await batch.commit();
  } catch (error) {
    log.warn("Failed to update Gmail sync jobs:", error);
  }
}

function extractGoogleActivationUrl(message: string) {
  const match = message.match(/https:\/\/console\.developers\.google\.com\/[^\s"}]+/);
  return match?.[0] || null;
}

function isGmailApiDisabledError(message: string) {
  return (
    message.includes("gmail.googleapis.com") &&
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
      .where("provider", "==", "gmail")
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json(
        { error: "No active Gmail integration found" },
        { status: 404 }
      );
    }

    const doc = snapshot.docs[0];
    const integration = doc.data();
    const integrationId = doc.id;
    const integrationRef = doc.ref;
    activeIntegrationId = integrationId;

    if (integration.status === "revoked") {
      const message = "Gmail access was revoked. Reconnect Gmail and try again.";
      await updateGmailSyncJobs(integrationId, {
        status: "failed",
        last_error: message,
        next_retry_at: null,
      });

      return NextResponse.json(
        { error: message },
        { status: 409 }
      );
    }

    const refreshIv = getRefreshIv(integration);
    if (
      typeof integration.access_token_enc !== "string" ||
      typeof integration.token_iv !== "string" ||
      typeof integration.refresh_token_enc !== "string" ||
      !refreshIv
    ) {
      const message = "Gmail integration needs to be reconnected";
      await updateIntegrationStatus(integrationId, "expired");
      await updateGmailSyncJobs(integrationId, {
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

    const synced = await runFullSync(adminDb, user.uid, integrationId, {
      accessToken,
      refreshToken,
      tokenExpiresAt,
    });

    let pipeline: { processed: number; insights: number } | null = null;
    try {
      pipeline = await runGmailInsightPipeline(adminDb, user.uid, integrationId);
    } catch (pipelineError) {
      log.warn("Gmail insight pipeline failed after sync:", pipelineError);
    }

    await updateGmailSyncJobs(integrationId, {
      status: "succeeded",
      next_retry_at: null,
      last_error: null,
    });

    await integrationRef.set(
      {
        status: "active",
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      synced,
      pipeline,
    });
  } catch (error) {
    const providerMessage = getErrorMessage(error);
    const responseMessage = "Gmail sync failed";
    log.error("Gmail sync error:", error);
    const gmailApiDisabled = isGmailApiDisabledError(providerMessage);
    const activationUrl = extractGoogleActivationUrl(providerMessage);

    if (activeIntegrationId) {
      if (isExpiredTokenError(providerMessage) && !gmailApiDisabled) {
        await updateIntegrationStatus(activeIntegrationId, "expired");
      } else {
        await updateIntegrationStatus(activeIntegrationId, "error");
      }

      await updateGmailSyncJobs(activeIntegrationId, {
        status: "failed",
        last_error: responseMessage,
        next_retry_at: null,
      });
    }

    if (gmailApiDisabled) {
      const configuredGoogleProjectNumber = getConfiguredGoogleProjectNumber();
      return NextResponse.json(
        {
          error:
            "Gmail API is disabled for the Google Cloud project used by this app. Enable Gmail API in Google Cloud Console, wait a few minutes, then retry sync.",
          errorCode: "GMAIL_API_DISABLED",
          activationUrl,
          details: providerMessage,
          configuredGoogleProjectNumber,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: responseMessage }, { status: 500 });
  }
}
