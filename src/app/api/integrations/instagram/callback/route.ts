import { NextResponse, type NextRequest } from "next/server";
import { encrypt } from "@/lib/utils/encryption";
import {
  exchangeForLongLivedToken,
  getUserPages,
  getInstagramAccount,
} from "@/lib/integrations/instagram/client";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import {
  clearOAuthSessionCookies,
  getOAuthSessionUserId,
} from "@/lib/integrations/oauth-session";
import { enqueueSyncJob, triggerSyncWorker } from "@/lib/integrations/sync-jobs";
import { getInstagramSchemaHealth } from "@/lib/integrations/schema-health";
import { getAppOrigin } from "@/lib/utils/url";

function redirectToIntegrations(query: string, request: NextRequest) {
  const response = NextResponse.redirect(
    new URL(`/integrations?${query}`, getAppOrigin(request))
  );
  clearOAuthSessionCookies(response, "instagram_oauth");
  return response;
}

export async function GET(request: NextRequest) {
  const appOrigin = getAppOrigin(request);
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

  // CSRF: validate state matches cookie
  const cookieState = request.cookies.get("instagram_oauth_state")?.value;
  if (!state || state !== cookieState) {
    return redirectToIntegrations("error=invalid_state", request);
  }

  const userId = getOAuthSessionUserId(request, "instagram_oauth");
  if (!userId) {
    return redirectToIntegrations("error=missing_oauth_session", request);
  }

  try {
    // Exchange authorization code for short-lived token
    const tokenRes = await fetch(
      "https://graph.facebook.com/v21.0/oauth/access_token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: process.env.META_APP_ID!,
          client_secret: process.env.META_APP_SECRET!,
          redirect_uri: `${appOrigin}/api/integrations/instagram/callback`,
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

    // Exchange short-lived → long-lived token (60 days)
    const longLived = await exchangeForLongLivedToken(shortLivedToken);
    const tokenExpiresAt = new Date(Date.now() + longLived.expiresIn * 1000);

    // Discover Instagram Business Account via Pages
    const config = { accessToken: longLived.accessToken, tokenExpiresAt };
    const pages = await getUserPages(config);

    const pageWithIg = pages.find((p) => p.instagram_business_account);
    if (!pageWithIg || !pageWithIg.instagram_business_account) {
      throw new Error(
        "No Instagram Business account found. Ensure your Instagram account is linked to a Facebook Page as a Business or Creator account."
      );
    }

    const igUserId = pageWithIg.instagram_business_account.id;
    const igAccount = await getInstagramAccount(config, igUserId);

    // Encrypt token
    const { encrypted: accessTokenEnc, iv: accessIv } = encrypt(
      longLived.accessToken
    );

    // Store integration record
    const existingSnapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATIONS)
      .where("user_id", "==", userId)
      .where("provider", "==", "instagram")
      .get();

    const integrationData = {
      user_id: userId,
      provider: "instagram",
      provider_account_id: igUserId,
      provider_account_name: `@${igAccount.username}`,
      access_token_enc: accessTokenEnc,
      token_iv: accessIv,
      scopes: [
        "instagram_basic",
        "instagram_manage_insights",
        "pages_show_list",
        "pages_read_engagement",
        "business_management",
      ],
      token_expires_at: tokenExpiresAt.toISOString(),
      status: "active",
      sync_cursor: { ig_user_id: igUserId },
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

    const schemaHealth = await getInstagramSchemaHealth(adminDb);
    if (!schemaHealth.ok) {
      await adminDb
        .collection(COLLECTIONS.INTEGRATIONS)
        .doc(integrationId)
        .update({ status: "error" });

      return redirectToIntegrations(
        `error=${encodeURIComponent(
          `instagram_schema_missing:${schemaHealth.missingTables.join(",")}`
        )}`,
        request
      );
    }

    // Queue initial sync
    await enqueueSyncJob(adminDb, {
      userId,
      integrationId: integrationId,
      provider: "instagram",
    });
    void triggerSyncWorker("instagram");

    return redirectToIntegrations("success=instagram_connected", request);
  } catch (err) {
    console.error("Instagram OAuth error:", err);
    const message =
      err instanceof Error ? err.message : "instagram_oauth_failed";
    return redirectToIntegrations(
      `error=${encodeURIComponent(message)}`,
      request
    );
  }
}
