import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import {
  exchangeSlackCode,
  persistSlackConnection,
  listSlackChannels,
  type SlackConfig,
} from "@/lib/integrations/slack/client";
import { runSlackSync } from "@/lib/integrations/slack/sync";
import { createServerLogger } from "@/lib/server-logger";

export const runtime = "nodejs";

const log = createServerLogger("SlackCallbackApi");

export async function GET(request: NextRequest) {
  const { user, error } = await requireAuth(request);
  if (error) {
    return error;
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(
      `/integrations?slack=error&reason=${encodeURIComponent(oauthError)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect("/integrations?slack=error&reason=missing_code");
  }

  if (state && state !== user.uid) {
    return NextResponse.redirect("/integrations?slack=error&reason=state_mismatch");
  }

  try {
    const redirectUri = process.env.SLACK_REDIRECT_URI;
    if (!redirectUri) {
      return NextResponse.redirect("/integrations?slack=error&reason=config");
    }

    const auth = await exchangeSlackCode(code, redirectUri);
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
    ];

    const integrationId = await persistSlackConnection(
      adminDb,
      user.uid,
      auth.teamId,
      auth.accessToken,
      scopes,
    );

    const config: SlackConfig = {
      accessToken: auth.accessToken,
      botUserId: auth.botUserId,
      teamId: auth.teamId,
    };

    try {
      const channels = await listSlackChannels(config);
      await runSlackSync(adminDb, user.uid, integrationId, config, channels);
    } catch (syncErr) {
      log.warn("Slack channel sync failed during connect.", syncErr);
    }

    log.info("Slack connected.", { userId: user.uid, integrationId });
    return NextResponse.redirect("/integrations?slack=connected");
  } catch (routeError) {
    log.error("Slack callback failed.", routeError);
    return NextResponse.redirect(
      `/integrations?slack=error&reason=${encodeURIComponent(
        routeError instanceof Error ? routeError.message : "unknown",
      )}`,
    );
  }
}
