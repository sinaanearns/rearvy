import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { encrypt } from "@/lib/utils/encryption";
import {
  clearOAuthSessionCookies,
  getOAuthSessionUserId,
} from "@/lib/integrations/oauth-session";
import { createServerLogger } from "@/lib/server-logger";
import { getAppOrigin } from "@/lib/utils/url";

type MicrosoftTokenData = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
};

type MicrosoftProfile = {
  id: string;
  displayName?: string;
  mail?: string;
  userPrincipalName?: string;
};

type ExcelOAuthSession = {
  cookiePrefix: "excel_oauth";
  successQuery: string;
  fallbackError: string;
};

const EXCEL_OAUTH_SESSION: ExcelOAuthSession = {
  cookiePrefix: "excel_oauth",
  successQuery: "success=excel_connected",
  fallbackError: "excel_oauth_failed",
};

const FALLBACK_TOKEN_EXPIRES_IN_SECONDS = 3600;
const log = createServerLogger("ExcelOAuth");

function getMicrosoftOAuthRequestOrigin(request: NextRequest): string {
  return getAppOrigin(request);
}

export function getExcelOAuthAuthorizationRedirectUri(request: NextRequest): string {
  return new URL(
    "/api/integrations/excel/callback",
    getMicrosoftOAuthRequestOrigin(request)
  ).toString();
}

function redirectToIntegrations(request: NextRequest, query: string) {
  const response = NextResponse.redirect(
    new URL(
      `/work/integrations?${query}`,
      getMicrosoftOAuthRequestOrigin(request)
    )
  );
  clearOAuthSessionCookies(response, EXCEL_OAUTH_SESSION.cookiePrefix);
  return response;
}

function normalizeTokenExpiresIn(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : FALLBACK_TOKEN_EXPIRES_IN_SECONDS;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseMicrosoftTokenData(value: unknown): MicrosoftTokenData {
  if (!isRecord(value)) {
    throw new Error("Microsoft token exchange returned an invalid response");
  }

  if (typeof value.access_token !== "string" || !value.access_token) {
    throw new Error("Microsoft token exchange did not return an access token");
  }

  return {
    access_token: value.access_token,
    refresh_token:
      typeof value.refresh_token === "string" && value.refresh_token
        ? value.refresh_token
        : undefined,
    expires_in: normalizeTokenExpiresIn(value.expires_in),
    scope: typeof value.scope === "string" ? value.scope : undefined,
  };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function parseMicrosoftProfile(value: unknown): MicrosoftProfile {
  if (!isRecord(value)) {
    throw new Error("Microsoft profile response was invalid");
  }

  if (typeof value.id !== "string" || !value.id) {
    throw new Error("Microsoft profile response did not include an account id");
  }

  return {
    id: value.id,
    displayName: optionalString(value.displayName),
    mail: optionalString(value.mail),
    userPrincipalName: optionalString(value.userPrincipalName),
  };
}

async function exchangeMicrosoftOAuthCode(
  request: NextRequest,
  code: string
): Promise<MicrosoftTokenData> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenantId = process.env.MICROSOFT_TENANT_ID?.trim() || "common";

  if (!clientId || !clientSecret) {
    throw new Error("Missing Microsoft OAuth credentials");
  }

  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: getExcelOAuthAuthorizationRedirectUri(request),
        grant_type: "authorization_code",
      }),
    }
  );

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`Token exchange failed (${tokenRes.status}): ${text}`);
  }

  return parseMicrosoftTokenData(await tokenRes.json().catch(() => null));
}

async function fetchMicrosoftProfile(
  accessToken: string
): Promise<MicrosoftProfile> {
  const profileRes = await fetch(
    "https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!profileRes.ok) {
    throw new Error("Failed to fetch Microsoft profile info");
  }

  return parseMicrosoftProfile(await profileRes.json().catch(() => null));
}

export async function handleExcelOAuthCallback(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return redirectToIntegrations(request, `error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return redirectToIntegrations(request, "error=missing_code");
  }

  if (!state) {
    return redirectToIntegrations(request, "error=invalid_state");
  }

  const stateMatches =
    request.cookies.get(`${EXCEL_OAUTH_SESSION.cookiePrefix}_state`)?.value ===
    state;
  if (!stateMatches) {
    return redirectToIntegrations(request, "error=invalid_state");
  }

  const userId = getOAuthSessionUserId(request, EXCEL_OAUTH_SESSION.cookiePrefix);
  if (!userId) {
    return redirectToIntegrations(request, "error=missing_oauth_session");
  }

  try {
    const tokenData = await exchangeMicrosoftOAuthCode(request, code);
    const { access_token, refresh_token, expires_in, scope } = tokenData;

    if (!refresh_token) {
      throw new Error(
        "No refresh token received. User may need to re-authorize Excel access."
      );
    }

    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);
    const profile = await fetchMicrosoftProfile(access_token);
    const { encrypted: accessTokenEnc, iv: accessIv } = encrypt(access_token);
    const { encrypted: refreshTokenEnc, iv: refreshIv } = encrypt(refresh_token);
    const nowIso = new Date().toISOString();

    const integrationData = {
      user_id: userId,
      provider: "excel",
      provider_account_id: profile.id,
      provider_account_name:
        profile.displayName ||
        profile.mail ||
        profile.userPrincipalName ||
        "Excel account",
      access_token_enc: accessTokenEnc,
      refresh_token_enc: refreshTokenEnc,
      token_iv: accessIv,
      scopes: scope ? scope.split(" ") : [],
      token_expires_at: tokenExpiresAt.toISOString(),
      status: "active",
      sync_cursor: {
        refresh_iv: refreshIv,
        source_type: "microsoft_graph",
        oauth_redirect_uri: getExcelOAuthAuthorizationRedirectUri(request),
      },
      updated_at: nowIso,
    };

    const existingSnapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATIONS)
      .where("user_id", "==", userId)
      .where("provider", "==", "excel")
      .get();

    if (!existingSnapshot.empty) {
      await existingSnapshot.docs[0].ref.set(integrationData, { merge: true });
    } else {
      await adminDb.collection(COLLECTIONS.INTEGRATIONS).add({
        ...integrationData,
        created_at: nowIso,
      });
    }

    return redirectToIntegrations(request, EXCEL_OAUTH_SESSION.successQuery);
  } catch (err) {
    log.error("Excel OAuth error:", err);
    return redirectToIntegrations(
      request,
      `error=${encodeURIComponent(
        err instanceof Error ? err.message : EXCEL_OAUTH_SESSION.fallbackError
      )}`
    );
  }
}
