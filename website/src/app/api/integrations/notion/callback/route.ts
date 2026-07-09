import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import {
  exchangeNotionCode,
  persistNotionConnection,
  searchNotion,
} from "@/lib/integrations/notion/client";
import { runNotionSync } from "@/lib/integrations/notion/sync";
import { createServerLogger } from "@/lib/server-logger";

export const runtime = "nodejs";

const log = createServerLogger("NotionCallbackApi");

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
    return NextResponse.redirect(`/integrations?notion=error&reason=${oauthError}`);
  }
  if (!code) {
    return NextResponse.redirect("/integrations?notion=error&reason=missing_code");
  }
  if (state && state !== user.uid) {
    return NextResponse.redirect("/integrations?notion=error&reason=state_mismatch");
  }

  try {
    const redirectUri = process.env.NOTION_REDIRECT_URI;
    if (!redirectUri) {
      return NextResponse.redirect("/integrations?notion=error&reason=config");
    }

    const auth = await exchangeNotionCode(code, redirectUri);
    const scopes = ["page:read", "page:write"];

    const integrationId = await persistNotionConnection(
      adminDb,
      user.uid,
      auth.accessToken,
      scopes,
    );

    try {
      const pages = await searchNotion({ accessToken: auth.accessToken }, "", 20);
      await runNotionSync(adminDb, user.uid, integrationId, { accessToken: auth.accessToken }, pages);
    } catch (syncErr) {
      log.warn("Notion page sync failed during connect.", syncErr);
    }

    log.info("Notion connected.", { userId: user.uid, integrationId });
    return NextResponse.redirect("/integrations?notion=connected");
  } catch (routeError) {
    log.error("Notion callback failed.", routeError);
    return NextResponse.redirect(
      `/integrations?notion=error&reason=${encodeURIComponent(
        routeError instanceof Error ? routeError.message : "unknown",
      )}`,
    );
  }
}
