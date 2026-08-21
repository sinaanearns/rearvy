import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { createServerLogger } from "@/lib/server-logger";

export const runtime = "nodejs";

const log = createServerLogger("SlackConnectApi");

export async function GET(request: NextRequest) {
  const { user, error } = await requireAuth(request);
  if (error) {
    return error;
  }

  const clientId = process.env.SLACK_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "Slack OAuth is not configured on this server." },
      { status: 500 },
    );
  }

  const redirectUri = process.env.SLACK_REDIRECT_URI;
  if (!redirectUri) {
    return NextResponse.json(
      { error: "Missing SLACK_REDIRECT_URI environment variable." },
      { status: 500 },
    );
  }

  const scopes = [
    "channels:read",
    "channels:history",
    "groups:read",
    "groups:history",
    "im:read",
    "mpim:read",
    "chat:write",
    "users:read",
    "team:read",
  ].join(",");

  const params = new URLSearchParams({
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri,
    state: user.uid,
    response_type: "code",
  });

  const authUrl = `https://slack.com/oauth/v2/authorize?${params.toString()}`;

  log.info("Redirecting user to Slack OAuth.", { userId: user.uid });
  return NextResponse.redirect(authUrl);
}
