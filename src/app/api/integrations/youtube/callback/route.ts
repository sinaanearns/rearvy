import { NextResponse, type NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/supabase/server";
import { encrypt } from "@/lib/utils/encryption";
import { getChannelInfo } from "@/lib/integrations/youtube/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueSyncJob, triggerSyncWorker } from "@/lib/integrations/sync-jobs";

function redirectToIntegrations(query: string) {
  const response = NextResponse.redirect(
    new URL(`/integrations?${query}`, process.env.NEXT_PUBLIC_APP_URL!)
  );
  response.cookies.delete("youtube_oauth_state");
  return response;
}

export async function GET(request: NextRequest) {
  const {
    data: { user },
  } = await getUserFromRequest(request);

  if (!user) {
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
  const cookieState = request.cookies.get("youtube_oauth_state")?.value;
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
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/youtube/callback`,
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

    // Get channel info
    const channelInfo = await getChannelInfo({
      accessToken: access_token,
      refreshToken: refresh_token,
      tokenExpiresAt,
    });

    // Encrypt tokens (separate IVs for access and refresh)
    const { encrypted: accessTokenEnc, iv: accessIv } = encrypt(access_token);
    const { encrypted: refreshTokenEnc, iv: refreshIv } =
      encrypt(refresh_token);

    const adminSupabase = createAdminClient();

    // Store integration record
    const { data: integration, error: insertError } = await adminSupabase
      .from("integrations")
      .upsert(
        {
          user_id: user.id,
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
        },
        { onConflict: "user_id,provider" }
      )
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to save integration: ${insertError.message}`);
    }

    // Queue durable initial sync with retries.
    await enqueueSyncJob(adminSupabase, {
      userId: user.id,
      integrationId: integration.id,
      provider: "youtube",
    });
    void triggerSyncWorker("youtube");

    return redirectToIntegrations("success=youtube_connected");
  } catch (err) {
    console.error("YouTube OAuth error:", err);
    return redirectToIntegrations("error=youtube_oauth_failed");
  }
}
