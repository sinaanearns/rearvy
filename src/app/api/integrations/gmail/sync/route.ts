import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { decrypt } from "@/lib/utils/encryption";
import { runFullSync } from "@/lib/integrations/gmail/sync";
import { runGmailInsightPipeline } from "@/lib/insights/gmail-pipeline";

export const runtime = "nodejs";

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

    if (integration.status === "revoked") {
      return NextResponse.json(
        { error: "Gmail access was revoked. Reconnect Gmail and try again." },
        { status: 409 }
      );
    }

    const refreshIv = (
      integration.sync_cursor as { refresh_iv?: string } | null
    )?.refresh_iv;

    if (!integration.refresh_token_enc || !refreshIv) {
      return NextResponse.json(
        { error: "Integration missing refresh token" },
        { status: 500 }
      );
    }

    const accessToken = decrypt(
      integration.access_token_enc,
      integration.token_iv
    );
    const refreshToken = decrypt(integration.refresh_token_enc, refreshIv);
    const tokenExpiresAt = new Date(integration.token_expires_at || Date.now());

    const synced = await runFullSync(adminDb, user.uid, integrationId, {
      accessToken,
      refreshToken,
      tokenExpiresAt,
    });

    let pipeline: { processed: number; insights: number } | null = null;
    try {
      pipeline = await runGmailInsightPipeline(adminDb, user.uid, integrationId);
    } catch (pipelineError) {
      console.error("Gmail insight pipeline failed after sync:", pipelineError);
    }

    const syncJobsSnapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATION_SYNC_JOBS)
      .where("integration_id", "==", integrationId)
      .where("provider", "==", "gmail")
      .get();

    if (!syncJobsSnapshot.empty) {
      const batch = adminDb.batch();
      syncJobsSnapshot.docs.forEach((job) => {
        batch.update(job.ref, {
          status: "succeeded",
          next_retry_at: null,
          last_error: null,
        });
      });
      await batch.commit();
    }

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
    const message = error instanceof Error ? error.message : "Gmail sync failed";
    console.error("Gmail sync error:", error);
    const gmailApiDisabled = isGmailApiDisabledError(message);
    const activationUrl = extractGoogleActivationUrl(message);

    const integrationSnapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATIONS)
      .where("user_id", "==", user.uid)
      .where("provider", "==", "gmail")
      .limit(1)
      .get();

    if (!integrationSnapshot.empty) {
      const integrationRef = integrationSnapshot.docs[0].ref;
      if (
        (message.includes("401") ||
        message.includes("invalid_grant")
        ) &&
        !gmailApiDisabled
      ) {
        await integrationRef.update({ status: "expired" });
      } else {
        await integrationRef.set(
          {
            status: "error",
            updated_at: new Date().toISOString(),
          },
          { merge: true }
        );
      }

      const syncJobsSnapshot = await adminDb
        .collection(COLLECTIONS.INTEGRATION_SYNC_JOBS)
        .where("integration_id", "==", integrationSnapshot.docs[0].id)
        .where("provider", "==", "gmail")
        .get();

      if (!syncJobsSnapshot.empty) {
        const batch = adminDb.batch();
        syncJobsSnapshot.docs.forEach((job) => {
          batch.update(job.ref, {
            status: "failed",
            last_error: message,
            next_retry_at: null,
          });
        });
        await batch.commit();
      }
    }

    if (gmailApiDisabled) {
      const configuredGoogleProjectNumber = getConfiguredGoogleProjectNumber();
      return NextResponse.json(
        {
          error:
            "Gmail API is disabled for the Google Cloud project used by this app. Enable Gmail API in Google Cloud Console, wait a few minutes, then retry sync.",
          errorCode: "GMAIL_API_DISABLED",
          activationUrl,
          details: message,
          configuredGoogleProjectNumber,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
