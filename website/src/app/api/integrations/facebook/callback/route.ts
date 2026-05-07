import { NextResponse, type NextRequest } from "next/server";
import { encrypt } from "@/lib/utils/encryption";
import {
  exchangeForLongLivedToken,
  getUserPages,
} from "@/lib/integrations/facebook/client";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import {
  clearOAuthSessionCookies,
  getOAuthSessionUserId,
} from "@/lib/integrations/oauth-session";
import { enqueueSyncJob, triggerSyncWorker } from "@/lib/integrations/sync-jobs";
import { getFacebookSchemaHealth } from "@/lib/integrations/schema-health";
import { getAppOrigin } from "@/lib/utils/url";

function redirectToIntegrations(query: string, request: NextRequest) {
  const response = NextResponse.redirect(
    new URL(`/integrations?${query}`, getAppOrigin(request))
  );
  clearOAuthSessionCookies(response, "facebook_oauth");
  return response;
}

export async function GET(request: NextRequest) {
  const appOrigin = getAppOrigin(request);
  const clientId = process.env.META_APP_ID;
  const clientSecret = process.env.META_APP_SECRET;
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

  const cookieState = request.cookies.get("facebook_oauth_state")?.value;
  if (!state || state !== cookieState) {
    return redirectToIntegrations("error=invalid_state", request);
  }

  const userId = getOAuthSessionUserId(request, "facebook_oauth");
  if (!userId) {
    return redirectToIntegrations("error=missing_oauth_session", request);
  }

  if (!clientId || !clientSecret) {
    return redirectToIntegrations(
      `error=${encodeURIComponent("facebook_not_configured")}`,
      request
    );
  }

  try {
    const tokenRes = await fetch(
      "https://graph.facebook.com/v21.0/oauth/access_token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: `${appOrigin}/api/integrations/facebook/callback`,
          grant_type: "authorization_code",
        }),
      }
    );

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      throw new Error(`Token exchange failed (${tokenRes.status}): ${text}`);
    }

    const tokenData = await tokenRes.json();
    const shortLivedToken = tokenData.access_token;

    const longLived = await exchangeForLongLivedToken(shortLivedToken);
    const tokenExpiresAt = new Date(Date.now() + longLived.expiresIn * 1000);

    const config = { accessToken: longLived.accessToken, tokenExpiresAt };
    const pages = await getUserPages(config);

    if (pages.length === 0) {
      throw new Error("No Facebook Pages found for this account.");
    }

    const { encrypted: accessTokenEnc, iv: accessIv } = encrypt(
      longLived.accessToken
    );

    const existingSnapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATIONS)
      .where("user_id", "==", userId)
      .where("provider", "==", "facebook")
      .get();

    const integrationData = {
      user_id: userId,
      provider: "facebook",
      provider_account_id: pages[0].id,
      provider_account_name: pages[0].name,
      access_token_enc: accessTokenEnc,
      token_iv: accessIv,
      scopes: [
        "pages_show_list",
        "pages_read_engagement",
        "read_insights",
        "pages_manage_metadata",
        "pages_read_user_content",
        "pages_manage_posts",
        "pages_manage_engagement",
        "public_profile",
        "email",
      ],
      token_expires_at: tokenExpiresAt.toISOString(),
      status: "active",
      sync_cursor: { page_ids: pages.map((p) => p.id) },
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

    const schemaHealth = await getFacebookSchemaHealth(adminDb);
    if (!schemaHealth.ok) {
      await adminDb
        .collection(COLLECTIONS.INTEGRATIONS)
        .doc(integrationId)
        .update({ status: "error" });

      return redirectToIntegrations(
        `error=${encodeURIComponent(
          `facebook_schema_missing:${schemaHealth.missingTables.join(",")}`
        )}`,
        request
      );
    }

    await enqueueSyncJob(adminDb, {
      userId,
      integrationId: integrationId,
      provider: "facebook",
    });
    void triggerSyncWorker("facebook");

    return redirectToIntegrations("success=facebook_connected", request);
  } catch (err) {
    console.error("Facebook OAuth error:", err);
    const message = err instanceof Error ? err.message : "facebook_oauth_failed";
    return redirectToIntegrations(`error=${encodeURIComponent(message)}`, request);
  }
}
