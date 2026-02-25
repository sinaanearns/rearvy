import { NextResponse, type NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/supabase/server";
import { encrypt } from "@/lib/utils/encryption";
import { getUserInfo } from "@/lib/integrations/tiktok/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueSyncJob, triggerSyncWorker } from "@/lib/integrations/sync-jobs";
import { getTikTokSchemaHealth } from "@/lib/integrations/schema-health";

function redirectToIntegrations(query: string) {
  const response = NextResponse.redirect(
    new URL(`/integrations?${query}`, process.env.NEXT_PUBLIC_APP_URL!)
  );
  response.cookies.delete("tiktok_oauth_state");
  response.cookies.delete("tiktok_code_verifier");
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

  // CSRF: validate state matches cookie
  const cookieState = request.cookies.get("tiktok_oauth_state")?.value;
  if (!state || state !== cookieState) {
    return redirectToIntegrations("error=invalid_state");
  }

  const codeVerifier = request.cookies.get("tiktok_code_verifier")?.value;
  if (!codeVerifier) {
    return redirectToIntegrations("error=missing_code_verifier");
  }

  try {
    // Exchange authorization code for tokens
    const tokenRes = await fetch(
      "https://open.tiktokapis.com/v2/oauth/token/",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_key: process.env.TIKTOK_CLIENT_KEY!,
          client_secret: process.env.TIKTOK_CLIENT_SECRET!,
          code,
          grant_type: "authorization_code",
          redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/tiktok/callback`,
          code_verifier: codeVerifier,
        }),
      }
    );

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      throw new Error(`Token exchange failed (${tokenRes.status}): ${text}`);
    }

    const tokenData = await tokenRes.json();
    const {
      access_token,
      refresh_token,
      expires_in,
      open_id,
      scope,
    } = tokenData;

    if (!refresh_token) {
      throw new Error("No refresh token received from TikTok.");
    }

    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);

    // Get user info for display name
    const userInfo = await getUserInfo({
      accessToken: access_token,
      refreshToken: refresh_token,
      tokenExpiresAt,
    });

    // Encrypt tokens (separate IVs)
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
          provider: "tiktok",
          provider_account_id: open_id,
          provider_account_name: userInfo.display_name || open_id,
          access_token_enc: accessTokenEnc,
          refresh_token_enc: refreshTokenEnc,
          token_iv: accessIv,
          scopes: scope ? scope.split(",") : [],
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

    const schemaHealth = await getTikTokSchemaHealth(adminSupabase);
    if (!schemaHealth.ok) {
      await adminSupabase
        .from("integrations")
        .update({ status: "error" })
        .eq("id", integration.id);

      return redirectToIntegrations(
        `error=${encodeURIComponent(
          `tiktok_schema_missing:${schemaHealth.missingTables.join(",")}`
        )}`
      );
    }

    // Queue initial sync
    await enqueueSyncJob(adminSupabase, {
      userId: user.id,
      integrationId: integration.id,
      provider: "tiktok",
    });
    void triggerSyncWorker("tiktok");

    return redirectToIntegrations("success=tiktok_connected");
  } catch (err) {
    console.error("TikTok OAuth error:", err);
    return redirectToIntegrations("error=tiktok_oauth_failed");
  }
}
