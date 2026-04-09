import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { requireAuth } from "@/lib/firebase/middleware";
import { setOAuthSessionCookies } from "@/lib/integrations/oauth-session";
import { getExcelOAuthAuthorizationRedirectUri } from "@/lib/integrations/excel-oauth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const tenantId = process.env.MICROSOFT_TENANT_ID?.trim() || "common";
    if (!clientId) {
      return NextResponse.json(
        {
          error:
            "Excel integration is not configured on this server. Add MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET to your environment variables.",
        },
        { status: 503 }
      );
    }

    const state = randomBytes(16).toString("hex");
    const redirectUri = getExcelOAuthAuthorizationRedirectUri(request);
    // Use least-privilege delegated scopes for per-user workbook reads.
    const scopes = ["offline_access", "User.Read", "Files.Read"].join(" ");

    const authUrl = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", state);

    const response = NextResponse.json({ url: authUrl.toString() });
    setOAuthSessionCookies(response, "excel_oauth", state, user.uid);

    return response;
  } catch (error) {
    console.error("Excel connect error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start Excel connection" },
      { status: 500 }
    );
  }
}