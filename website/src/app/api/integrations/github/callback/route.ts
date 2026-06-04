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
import { exchangeGitHubCode, getGitHubUserProfile } from "@/lib/integrations/github/client";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("GitHubCallbackApi");

function redirectToIntegrations(query: string, request: NextRequest) {
  const response = NextResponse.redirect(
    new URL(`/work/integrations?${query}`, getAppOrigin(request))
  );
  clearOAuthSessionCookies(response, "github_oauth");
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

  const cookieState = request.cookies.get("github_oauth_state")?.value;
  if (!state || state !== cookieState) {
    return redirectToIntegrations("error=invalid_state", request);
  }

  const userId = getOAuthSessionUserId(request, "github_oauth");
  if (!userId) {
    return redirectToIntegrations("error=missing_oauth_session", request);
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return redirectToIntegrations("error=github_not_configured", request);
  }

  try {
    const redirectUri = `${getAppOrigin(request)}/api/integrations/github/callback`;
    const { accessToken } = await exchangeGitHubCode(code, redirectUri);
    const profile = await getGitHubUserProfile({ accessToken });
    const { encrypted: accessTokenEnc, iv: accessIv } = encrypt(accessToken);

    const existingSnapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATIONS)
      .where("user_id", "==", userId)
      .where("provider", "==", "github")
      .get();

    const integrationData = {
      user_id: userId,
      provider: "github",
      provider_account_id: String(profile.id),
      provider_account_name: profile.name || profile.login,
      access_token_enc: accessTokenEnc,
      token_iv: accessIv,
      scopes: ["read:user", "user:email", "read:org", "repo"],
      token_expires_at: null,
      status: "active",
      sync_cursor: { repo_limit: 40 },
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

    await enqueueSyncJob(adminDb, {
      userId,
      integrationId,
      provider: "github",
    });
    void triggerSyncWorker("github");

    return redirectToIntegrations("success=github_connected", request);
  } catch (err) {
    log.error("GitHub OAuth error:", err);
    const message = err instanceof Error ? err.message : "github_oauth_failed";
    return redirectToIntegrations(`error=${encodeURIComponent(message)}`, request);
  }
}
