import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";

import { requireAuth } from "@/lib/firebase/middleware";
import { isLinkedInIntegrationConfigured } from "@/lib/integrations/provider-config";
import { setOAuthSessionCookies } from "@/lib/integrations/oauth-session";
import { getAppOrigin } from "@/lib/utils/url";

const LINKEDIN_SCOPES = [
  "r_liteprofile",
  "r_emailaddress",
  "w_member_social",
].join(" ");

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) {
      return authError;
    }

    const clientId = process.env.LINKEDIN_CLIENT_ID;
    if (!isLinkedInIntegrationConfigured() || !clientId) {
      return NextResponse.json(
        {
          error:
            "LinkedIn integration is not configured on this server. Add LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET to your environment variables.",
        },
        { status: 503 }
      );
    }

    const state = randomBytes(16).toString("hex");
    const redirectUri = `${getAppOrigin(request)}/api/integrations/linkedin/callback`;

    const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", LINKEDIN_SCOPES);
    authUrl.searchParams.set("state", state);

    const response = NextResponse.json({ url: authUrl.toString() });
    setOAuthSessionCookies(response, "linkedin_oauth", state, user.uid);

    return response;
  } catch (err) {
    console.error("LinkedIn connect error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

