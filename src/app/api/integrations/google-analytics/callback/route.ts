import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { encrypt } from "@/lib/utils/encryption";
import { getPropertyInfo } from "@/lib/integrations/google-analytics/client";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { enqueueSyncJob, triggerSyncWorker } from "@/lib/integrations/sync-jobs";

function redirectToIntegrations(query: string) {
  const response = NextResponse.redirect(
    new URL(`/integrations?${query}`, process.env.NEXT_PUBLIC_APP_URL!)
  );
  response.cookies.delete("ga4_oauth_state");
  return response;
}

export async function GET(request: NextRequest) {
  const { user, error: authError } = await requireAuth(request);
  if (authError) {
    return NextResponse.redirect(
      new URL("/login", process.env.NEXT_PUBLIC_APP_URL!)
    );
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return redirectToIntegrations(`error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return redirectToIntegrations("error=missing_code");
  }

  // CSRF: validate state matches the cookie
  const cookieState = request.cookies.get("ga4_oauth_state")?.value;
  if (!state || state !== cookieState) {
    return redirectToIntegrations("error=invalid_state");
  }

  try {
    // Exchange authorization code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google-analytics/callback`,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      throw new Error(`Token exchange failed (${tokenRes.status}): ${text}`);
    }

    const tokenData = await tokenRes.json();
    const { access_token, refresh_token, expires_in, scope } = tokenData;

    if (!refresh_token) {
      throw new Error(
        "No refresh token received. User may need to revoke and re-authorize."
      );
    }

    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);

    // Get GA4 property info
    const propertyInfo = await getPropertyInfo({
      accessToken: access_token,
      refreshToken: refresh_token,
      tokenExpiresAt,
    });

    // Encrypt tokens (separate IVs for access and refresh)
    const { encrypted: accessTokenEnc, iv: accessIv } = encrypt(access_token);
    const { encrypted: refreshTokenEnc, iv: refreshIv } =
      encrypt(refresh_token);

    // Store integration record in Firestore
    const integrationData = {
      user_id: user.uid,
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
      created_at: new Date(),
      updated_at: new Date(),
    };

    const integrationRef = await adminDb
      .collection(COLLECTIONS.INTEGRATIONS)
      .add(integrationData);

    // Queue durable initial sync with retries.
    await enqueueSyncJob(adminDb, {
      userId: user.uid,
      integrationId: integrationRef.id,
      provider: "google_analytics",
    });
    void triggerSyncWorker("google_analytics");

    return redirectToIntegrations("success=google_analytics_connected");
  } catch (err) {
    console.error("Google Analytics OAuth error:", err);
    return redirectToIntegrations("error=google_analytics_oauth_failed");
  }
}
