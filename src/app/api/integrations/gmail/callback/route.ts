import { NextResponse, type NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { encrypt } from "@/lib/utils/encryption";
import { randomBytes } from "crypto";
import {
  getOAuthSessionUserId,
  clearOAuthSessionCookies,
} from "@/lib/integrations/oauth-session";
import { enqueueSyncJob, triggerSyncWorker } from "@/lib/integrations/sync-jobs";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { getAppOrigin } from "@/lib/utils/url";

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(
    new URL("/settings?tab=integrations", request.url)
  );
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      console.error("Gmail OAuth error:", error);
      response.cookies.set("integration_error", `Gmail connect failed: ${error}`, { path: "/" });
      return response;
    }

    if (!code || !state) {
      response.cookies.set("integration_error", "Missing OAuth parameters", { path: "/" });
      return response;
    }

    const savedState = request.cookies.get("gmail_oauth_state")?.value;
    const userId = getOAuthSessionUserId(request, "gmail_oauth");

    if (!savedState || !userId || state !== savedState) {
      response.cookies.set("integration_error", "Invalid or expired OAuth session. Please try again.", { path: "/" });
      return response;
    }

    clearOAuthSessionCookies(response, "gmail_oauth");

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Missing Google OAuth credentials");
    }

    const appOrigin = getAppOrigin(request);
    const redirectUri = `${appOrigin}/api/integrations/gmail/callback`;

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      throw new Error(`Token exchange failed: ${tokenRes.status} ${errText}`);
    }

    const tokens = await tokenRes.json();
    
    // We must get a refresh token on the first connection
    if (!tokens.refresh_token) {
      response.cookies.set(
        "integration_error", 
        "Missing refresh token. Please remove Rearvy from your Google account permissions and try connecting again.", 
        { path: "/" }
      );
      return response;
    }

    // Get user profile info to store account name
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    
    if (!profileRes.ok) {
      throw new Error("Failed to fetch Google profile info");
    }
    
    const profile = await profileRes.json();
    const accountEmail = profile.email;

    const accessEncryption = encrypt(tokens.access_token);
    const refreshEncryption = encrypt(tokens.refresh_token);

    const adminDb = getAdminDb();
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
      scopes: tokens.scope.split(" "),
      token_expires_at: new Date(now.getTime() + tokens.expires_in * 1000).toISOString(),
      status: "active",
      sync_cursor: {
        refresh_iv: refreshEncryption.iv,
      },
      updated_at: now.toISOString(),
      created_at: now.toISOString(), // Will be merged if exists
    };

    const docRef = adminDb.collection(COLLECTIONS.INTEGRATIONS).doc(integrationId);
    await docRef.set(integrationData, { merge: true });

    // Enqueue the initial sync job
    await enqueueSyncJob(adminDb, {
      userId,
      integrationId,
      provider: "gmail",
    });

    response.cookies.set("integration_success", "Gmail connected successfully", { path: "/" });
    
    // Trigger worker asynchronously
    triggerSyncWorker("gmail").catch(console.error);

    return response;
  } catch (err) {
    console.error("Gmail callback error:", err);
    response.cookies.set("integration_error", "An unexpected error occurred during Gmail connection.", { path: "/" });
    return response;
  }
}
