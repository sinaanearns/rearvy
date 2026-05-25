import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { encrypt } from "@/lib/utils/encryption";
import {
  clearOAuthSessionCookies,
  getOAuthSessionUserId,
} from "@/lib/integrations/oauth-session";
import { enqueueSyncJob, triggerSyncWorker } from "@/lib/integrations/sync-jobs";
import { getAppOrigin } from "@/lib/utils/url";
import { exchangeLinkedInCode, getLinkedInUserProfile } from "@/lib/integrations/linkedin/client";
import { getLinkedInSchemaHealth } from "@/lib/integrations/schema-health";

function redirectToIntegrations(query: string, request: NextRequest) {
  const response = NextResponse.redirect(
    new URL(`/work/integrations?${query}`, getAppOrigin(request))
  );
  clearOAuthSessionCookies(response, "linkedin_oauth");
  return response;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return redirectToIntegrations(`error=${encodeURIComponent(error)}`, request);
  }

  if (!code) {
    return redirectToIntegrations("error=missing_code", request);
  }

  const cookieState = request.cookies.get("linkedin_oauth_state")?.value;
  if (!state || state !== cookieState) {
    return redirectToIntegrations("error=invalid_state", request);
  }

  const userId = getOAuthSessionUserId(request, "linkedin_oauth");
  if (!userId) {
    return redirectToIntegrations("error=missing_oauth_session", request);
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return redirectToIntegrations("error=linkedin_not_configured", request);
  }

  try {
    const redirectUri = `${getAppOrigin(request)}/api/integrations/linkedin/callback`;
    const { accessToken, expiresIn } = await exchangeLinkedInCode(code, redirectUri);
    const profile = await getLinkedInUserProfile({ accessToken });
    const { encrypted: accessTokenEnc, iv: accessIv } = encrypt(accessToken);

    const existingSnapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATIONS)
      .where("user_id", "==", userId)
      .where("provider", "==", "linkedin")
      .get();

    const integrationData = {
      user_id: userId,
      provider: "linkedin",
      provider_account_id: profile.id,
      provider_account_name: `${profile.localizedFirstName} ${profile.localizedLastName}`,
      access_token_enc: accessTokenEnc,
      token_iv: accessIv,
      scopes: ["r_liteprofile", "r_emailaddress", "w_member_social"],
      token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      status: "active",
      sync_cursor: {},
      updated_at: new Date().toISOString(),
    };

    let integrationId: string;
    if (!existingSnapshot.empty) {
      const existingDoc = existingSnapshot.docs[0];
      await existingDoc.ref.set(integrationData, { merge: true });
      integrationId = existingDoc.id;
    } else {
      const newDoc = await adminDb
        .collection(COLLECTIONS.INTEGRATIONS)
        .add({ ...integrationData, created_at: new Date().toISOString() });
      integrationId = newDoc.id;
    }

    const schemaHealth = await getLinkedInSchemaHealth(adminDb);
    if (!schemaHealth.ok) {
      await adminDb
        .collection(COLLECTIONS.INTEGRATIONS)
        .doc(integrationId)
        .update({ status: "error" });

      throw new Error(
        `linkedin_schema_missing:${schemaHealth.missingTables.join(",")}`
      );
    }

    await enqueueSyncJob(adminDb, {
      userId,
      integrationId,
      provider: "linkedin",
    });
    void triggerSyncWorker("linkedin");

    return redirectToIntegrations("success=linkedin_connected", request);
  } catch (err) {
    console.error("LinkedIn OAuth error:", err);
    const message = err instanceof Error ? err.message : "linkedin_oauth_failed";
    return redirectToIntegrations(`error=${encodeURIComponent(message)}`, request);
  }
}

