import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { encrypt } from "@/lib/utils/encryption";
import {
  clearOAuthSessionCookies,
  getOAuthSessionUserId,
} from "@/lib/integrations/oauth-session";
import { enqueueSyncJob, triggerSyncWorker } from "@/lib/integrations/sync-jobs";
import { getPropertyInfo } from "@/lib/integrations/google-analytics/client";
import { getYouTubeSchemaHealth } from "@/lib/integrations/schema-health";
import { getChannelInfo } from "@/lib/integrations/youtube/client";
import { getAppOrigin } from "@/lib/utils/url";

type GoogleOAuthProvider = "gmail" | "google_analytics" | "youtube";
type GoogleOAuthCookiePrefix = "ga4_oauth" | "gmail_oauth" | "youtube_oauth";

type GoogleOAuthSession = {
  provider: GoogleOAuthProvider;
  cookiePrefix: GoogleOAuthCookiePrefix;
  successQuery: string;
  fallbackError: string;
  logLabel: string;
};

const SHARED_GOOGLE_CALLBACK_PATH = "/api/integrations/google-analytics/callback";

function stripWrappingQuotes(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function canonicalizeGoogleOAuthOrigin(origin: string): string {
  try {
    const url = new URL(stripWrappingQuotes(origin));
    if (url.hostname === "rearvy.com") {
      url.hostname = "www.rearvy.com";
    }
    return url.origin;
  } catch {
    return origin;
  }
}

function resolveGoogleOAuthOrigin(request: NextRequest): string {
  const explicitOrigin = stripWrappingQuotes(
    process.env.GOOGLE_OAUTH_REDIRECT_ORIGIN ?? ""
  );
  if (explicitOrigin) {
    try {
      return canonicalizeGoogleOAuthOrigin(new URL(explicitOrigin).origin);
    } catch {
      // Fall through to the app origin when the override is malformed.
    }
  }

  const appUrl = stripWrappingQuotes(process.env.NEXT_PUBLIC_APP_URL ?? "");
  if (appUrl) {
    try {
      return canonicalizeGoogleOAuthOrigin(new URL(appUrl).origin);
    } catch {
      // Fall through to the app origin when the app URL is malformed.
    }
  }

  return canonicalizeGoogleOAuthOrigin(getAppOrigin(request));
}

const GOOGLE_OAUTH_SESSIONS: readonly GoogleOAuthSession[] = [
  {
    provider: "google_analytics",
    cookiePrefix: "ga4_oauth",
    successQuery: "success=google_analytics_connected",
    fallbackError: "google_analytics_oauth_failed",
    logLabel: "Google Analytics",
  },
  {
    provider: "gmail",
    cookiePrefix: "gmail_oauth",
    successQuery: "success=gmail_connected",
    fallbackError: "gmail_oauth_failed",
    logLabel: "Gmail",
  },
  {
    provider: "youtube",
    cookiePrefix: "youtube_oauth",
    successQuery: "success=youtube_connected",
    fallbackError: "youtube_oauth_failed",
    logLabel: "YouTube",
  },
] as const;

export function getGoogleOAuthAuthorizationRedirectUri(
  request: NextRequest
): string {
  return new URL(
    SHARED_GOOGLE_CALLBACK_PATH,
    getGoogleOAuthRequestOrigin(request)
  ).toString();
}

function getGoogleOAuthCallbackRequestUri(request: NextRequest): string {
  return new URL(
    request.nextUrl.pathname,
    getGoogleOAuthRequestOrigin(request)
  ).toString();
}

function getGoogleOAuthRequestOrigin(request: NextRequest): string {
  return resolveGoogleOAuthOrigin(request);
}

function extractGoogleActivationUrl(message: string): string | null {
  const match = message.match(/https:\/\/console\.developers\.google\.com\/[^\s"}]+/);
  return match?.[0] ?? null;
}

function isGa4ApiDisabledError(message: string): boolean {
  return (
    (message.includes("analyticsadmin.googleapis.com") ||
      message.includes("analyticsdata.googleapis.com")) &&
    (message.includes("SERVICE_DISABLED") ||
      message.includes("accessNotConfigured") ||
      message.includes("API has not been used in project"))
  );
}

function getConfiguredGoogleProjectNumber(): string | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) {
    return null;
  }

  const [projectNumber] = clientId.split("-", 1);
  return projectNumber && /^\d+$/.test(projectNumber) ? projectNumber : null;
}

function findGoogleOAuthSession(
  request: NextRequest,
  state: string | null
): GoogleOAuthSession | null {
  if (!state) {
    return null;
  }

  return (
    GOOGLE_OAUTH_SESSIONS.find(({ cookiePrefix }) => {
      return request.cookies.get(`${cookiePrefix}_state`)?.value === state;
    }) ?? null
  );
}

function redirectToIntegrations(
  request: NextRequest,
  query: string,
  cookiePrefix?: GoogleOAuthCookiePrefix
) {
  const response = NextResponse.redirect(
    new URL(`/integrations?${query}`, getGoogleOAuthRequestOrigin(request))
  );

  if (cookiePrefix) {
    clearOAuthSessionCookies(response, cookiePrefix);
  }

  return response;
}

async function exchangeGoogleOAuthCode(
  request: NextRequest,
  code: string
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing Google OAuth credentials");
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getGoogleOAuthCallbackRequestUri(request),
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`Token exchange failed (${tokenRes.status}): ${text}`);
  }

  return tokenRes.json();
}

async function handleGoogleAnalyticsCallback(
  request: NextRequest,
  session: GoogleOAuthSession,
  userId: string,
  code: string
) {
  const tokenData = await exchangeGoogleOAuthCode(request, code);
  const { access_token, refresh_token, expires_in, scope } = tokenData;

  if (!refresh_token) {
    throw new Error(
      "No refresh token received. User may need to revoke and re-authorize."
    );
  }

  const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);
  const propertyInfo = await getPropertyInfo({
    accessToken: access_token,
    refreshToken: refresh_token,
    tokenExpiresAt,
  });

  const { encrypted: accessTokenEnc, iv: accessIv } = encrypt(access_token);
  const { encrypted: refreshTokenEnc, iv: refreshIv } =
    encrypt(refresh_token);

  const integrationData = {
    user_id: userId,
    provider: "google_analytics",
    provider_account_id: propertyInfo.propertyId,
    provider_account_name: propertyInfo.displayName,
    access_token_enc: accessTokenEnc,
    refresh_token_enc: refreshTokenEnc,
    token_iv: accessIv,
    scopes: scope ? scope.split(" ") : [],
    token_expires_at: tokenExpiresAt.toISOString(),
    status: "active",
    sync_cursor: { refresh_iv: refreshIv },
    updated_at: new Date(),
  };

  const existingSnapshot = await adminDb
    .collection(COLLECTIONS.INTEGRATIONS)
    .where("user_id", "==", userId)
    .where("provider", "==", "google_analytics")
    .get();

  let integrationId: string;
  if (!existingSnapshot.empty) {
    const existingDoc = existingSnapshot.docs[0];
    await existingDoc.ref.set(integrationData, { merge: true });
    integrationId = existingDoc.id;
  } else {
    const integrationRef = await adminDb
      .collection(COLLECTIONS.INTEGRATIONS)
      .add({ ...integrationData, created_at: new Date() });
    integrationId = integrationRef.id;
  }

  await enqueueSyncJob(adminDb, {
    userId,
    integrationId,
    provider: "google_analytics",
  });
  void triggerSyncWorker("google_analytics");

  return redirectToIntegrations(request, session.successQuery, session.cookiePrefix);
}

async function handleGmailCallback(
  request: NextRequest,
  session: GoogleOAuthSession,
  userId: string,
  code: string
) {
  const tokenData = await exchangeGoogleOAuthCode(request, code);
  const { access_token, refresh_token, expires_in, scope } = tokenData;

  if (!refresh_token) {
    throw new Error(
      "Missing refresh token. Please remove Rearvy from your Google account permissions and try connecting again."
    );
  }

  const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!profileRes.ok) {
    throw new Error("Failed to fetch Google profile info");
  }

  const profile = await profileRes.json();
  const accountEmail = profile.email;
  const accessEncryption = encrypt(access_token);
  const refreshEncryption = encrypt(refresh_token);
  const integrationId = `gmail_${userId}`;
  const now = new Date();

  const integrationData = {
    id: integrationId,
    user_id: userId,
    provider: "gmail",
    provider_account_id: profile.id || accountEmail,
    provider_account_name: accountEmail,
    access_token_enc: accessEncryption.encrypted,
    refresh_token_enc: refreshEncryption.encrypted,
    token_iv: accessEncryption.iv,
    scopes: scope ? scope.split(" ") : [],
    token_expires_at: new Date(now.getTime() + expires_in * 1000).toISOString(),
    status: "active",
    sync_cursor: {
      refresh_iv: refreshEncryption.iv,
    },
    updated_at: now.toISOString(),
    created_at: now.toISOString(),
  };

  const docRef = adminDb.collection(COLLECTIONS.INTEGRATIONS).doc(integrationId);
  await docRef.set(integrationData, { merge: true });

  await enqueueSyncJob(adminDb, {
    userId,
    integrationId,
    provider: "gmail",
  });

  triggerSyncWorker("gmail").catch(console.error);

  return redirectToIntegrations(request, session.successQuery, session.cookiePrefix);
}

async function handleYouTubeCallback(
  request: NextRequest,
  session: GoogleOAuthSession,
  userId: string,
  code: string
) {
  const tokenData = await exchangeGoogleOAuthCode(request, code);
  const { access_token, refresh_token, expires_in, scope } = tokenData;

  if (!refresh_token) {
    throw new Error(
      "No refresh token received. User may need to revoke and re-authorize."
    );
  }

  const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);
  const channelInfo = await getChannelInfo({
    accessToken: access_token,
    refreshToken: refresh_token,
    tokenExpiresAt,
  });

  const { encrypted: accessTokenEnc, iv: accessIv } = encrypt(access_token);
  const { encrypted: refreshTokenEnc, iv: refreshIv } =
    encrypt(refresh_token);

  const existingSnapshot = await adminDb
    .collection(COLLECTIONS.INTEGRATIONS)
    .where("user_id", "==", userId)
    .where("provider", "==", "youtube")
    .get();

  const integrationData = {
    user_id: userId,
    provider: "youtube",
    provider_account_id: channelInfo.id,
    provider_account_name: channelInfo.snippet.title,
    access_token_enc: accessTokenEnc,
    refresh_token_enc: refreshTokenEnc,
    token_iv: accessIv,
    scopes: scope ? scope.split(" ") : [],
    token_expires_at: tokenExpiresAt.toISOString(),
    status: "active",
    sync_cursor: { refresh_iv: refreshIv },
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

  const schemaHealth = await getYouTubeSchemaHealth(adminDb);
  if (!schemaHealth.ok) {
    await adminDb
      .collection(COLLECTIONS.INTEGRATIONS)
      .doc(integrationId)
      .update({ status: "error" });

    throw new Error(
      `youtube_schema_missing:${schemaHealth.missingTables.join(",")}`
    );
  }

  await enqueueSyncJob(adminDb, {
    userId,
    integrationId,
    provider: "youtube",
  });
  void triggerSyncWorker("youtube");

  return redirectToIntegrations(request, session.successQuery, session.cookiePrefix);
}

export async function handleGoogleOAuthCallback(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const session = findGoogleOAuthSession(request, state);

  if (error) {
    return redirectToIntegrations(
      request,
      `error=${encodeURIComponent(error)}`,
      session?.cookiePrefix
    );
  }

  if (!code) {
    return redirectToIntegrations(
      request,
      "error=missing_code",
      session?.cookiePrefix
    );
  }

  if (!session || !state) {
    return redirectToIntegrations(request, "error=invalid_state");
  }

  const userId = getOAuthSessionUserId(request, session.cookiePrefix);
  if (!userId) {
    return redirectToIntegrations(
      request,
      "error=missing_oauth_session",
      session.cookiePrefix
    );
  }

  try {
    switch (session.provider) {
      case "google_analytics":
        return await handleGoogleAnalyticsCallback(request, session, userId, code);
      case "gmail":
        return await handleGmailCallback(request, session, userId, code);
      case "youtube":
        return await handleYouTubeCallback(request, session, userId, code);
    }
  } catch (err) {
    console.error(`${session.logLabel} OAuth error:`, err);
    const message = err instanceof Error ? err.message : session.fallbackError;

    if (session.provider === "google_analytics" && isGa4ApiDisabledError(message)) {
      const params = new URLSearchParams();
      params.set(
        "error",
        "Google Analytics API is disabled for the Google Cloud project used by this app. Enable Google Analytics Admin API and Google Analytics Data API in Google Cloud Console, wait a few minutes, then reconnect."
      );
      params.set("errorCode", "GA4_API_DISABLED");

      const activationUrl = extractGoogleActivationUrl(message);
      if (activationUrl) {
        params.set("activationUrl", activationUrl);
      }

      const configuredGoogleProjectNumber = getConfiguredGoogleProjectNumber();
      if (configuredGoogleProjectNumber) {
        params.set("configuredGoogleProjectNumber", configuredGoogleProjectNumber);
      }

      return redirectToIntegrations(
        request,
        params.toString(),
        session.cookiePrefix
      );
    }

    return redirectToIntegrations(
      request,
      `error=${encodeURIComponent(message)}`,
      session.cookiePrefix
    );
  }
}
