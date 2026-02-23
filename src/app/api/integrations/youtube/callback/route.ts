import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { encrypt } from "@/lib/utils/encryption";
import { getChannelInfo } from "@/lib/integrations/youtube/client";
import { runFullSync } from "@/lib/integrations/youtube/sync";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const {
    data: { user },
  } = await getUser();

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
    return NextResponse.redirect(
      new URL(
        `/integrations?error=${encodeURIComponent(error)}`,
        process.env.NEXT_PUBLIC_APP_URL!
      )
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL(
        "/integrations?error=missing_code",
        process.env.NEXT_PUBLIC_APP_URL!
      )
    );
  }

  // CSRF: validate state matches the cookie
  const cookieState = request.cookies.get("youtube_oauth_state")?.value;
  if (!state || state !== cookieState) {
    return NextResponse.redirect(
      new URL(
        "/integrations?error=invalid_state",
        process.env.NEXT_PUBLIC_APP_URL!
      )
    );
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

    // Trigger initial sync in background
    runFullSync(adminSupabase, user.id, integration.id, {
      accessToken: access_token,
      refreshToken: refresh_token,
      tokenExpiresAt,
    }).catch((err) => console.error("YouTube initial sync failed:", err));

    // Clear the state cookie and redirect
    const response = NextResponse.redirect(
      new URL(
        "/integrations?success=youtube_connected",
        process.env.NEXT_PUBLIC_APP_URL!
      )
    );
    response.cookies.delete("youtube_oauth_state");
    return response;
  } catch (err) {
    console.error("YouTube OAuth error:", err);
    return NextResponse.redirect(
      new URL(
        "/integrations?error=youtube_oauth_failed",
        process.env.NEXT_PUBLIC_APP_URL!
      )
    );
  }
}
