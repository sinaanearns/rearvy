import { NextResponse, type NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/supabase/server";
import { encrypt } from "@/lib/utils/encryption";
import {
  exchangeForLongLivedToken,
  getUserPages,
  getInstagramAccount,
} from "@/lib/integrations/instagram/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueSyncJob, triggerSyncWorker } from "@/lib/integrations/sync-jobs";
import { getInstagramSchemaHealth } from "@/lib/integrations/schema-health";

function redirectToIntegrations(query: string) {
  const response = NextResponse.redirect(
    new URL(`/integrations?${query}`, process.env.NEXT_PUBLIC_APP_URL!)
  );
  response.cookies.delete("instagram_oauth_state");
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
  const cookieState = request.cookies.get("instagram_oauth_state")?.value;
  if (!state || state !== cookieState) {
    return redirectToIntegrations("error=invalid_state");
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
          redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/instagram/callback`,
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

    const adminSupabase = createAdminClient();

    // Store integration record
    const { data: integration, error: insertError } = await adminSupabase
      .from("integrations")
      .upsert(
        {
          user_id: user.id,
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
        },
        { onConflict: "user_id,provider" }
      )
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to save integration: ${insertError.message}`);
    }

    const schemaHealth = await getInstagramSchemaHealth(adminSupabase);
    if (!schemaHealth.ok) {
      await adminSupabase
        .from("integrations")
        .update({ status: "error" })
        .eq("id", integration.id);

      return redirectToIntegrations(
        `error=${encodeURIComponent(
          `instagram_schema_missing:${schemaHealth.missingTables.join(",")}`
        )}`
      );
    }

    // Queue initial sync
    await enqueueSyncJob(adminSupabase, {
      userId: user.id,
      integrationId: integration.id,
      provider: "instagram",
    });
    void triggerSyncWorker("instagram");

    return redirectToIntegrations("success=instagram_connected");
  } catch (err) {
    console.error("Instagram OAuth error:", err);
    const message =
      err instanceof Error ? err.message : "instagram_oauth_failed";
    return redirectToIntegrations(`error=${encodeURIComponent(message)}`);
  }
}
