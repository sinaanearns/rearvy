import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { createServerLogger } from "@/lib/server-logger";

export const runtime = "nodejs";

const log = createServerLogger("NotionConnectApi");

export async function GET(request: NextRequest) {
  const { user, error } = await requireAuth(request);
  if (error) {
    return error;
  }

  const clientId = process.env.NOTION_CLIENT_ID;
  const redirectUri = process.env.NOTION_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Notion OAuth is not configured on this server." },
      { status: 500 },
    );
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    owner: "user",
    redirect_uri: redirectUri,
    state: user.uid,
  });

  const authUrl = `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;

  log.info("Redirecting user to Notion OAuth.", { userId: user.uid });
  return NextResponse.redirect(authUrl);
}
