import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { randomBytes } from "crypto";
import { isGoogleIntegrationConfigured } from "@/lib/integrations/provider-config";
import { setOAuthSessionCookies } from "@/lib/integrations/oauth-session";
import { getGoogleOAuthAuthorizationRedirectUri } from "@/lib/integrations/google-oauth";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("GmailConnectApi");

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (error) return error;

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!isGoogleIntegrationConfigured() || !clientId) {
      return NextResponse.json(
        { error: "Google integration is not configured on this server. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your environment variables." },
        { status: 503 }
      );
    }

    const state = randomBytes(16).toString("hex");
    const redirectUri = getGoogleOAuthAuthorizationRedirectUri(request);

    // Gmail review/send needs inbox access plus compose permissions.
    const scopes = [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.compose",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile"
    ].join(" ");

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("access_type", "offline");
    // Force consent prompt to guarantee we get a refresh token
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", state);

    const response = NextResponse.json({ url: authUrl.toString() });
    setOAuthSessionCookies(response, "gmail_oauth", state, user.uid);

    return response;
  } catch (err) {
    log.error("Gmail connect error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
