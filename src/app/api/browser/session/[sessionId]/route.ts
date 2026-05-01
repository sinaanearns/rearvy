import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../../lib/firebase/middleware";
import { serializeLiveBrowserSession } from "../../../../../lib/live-browser/presenter";
import { getLiveBrowserSessionManager } from "../../../../../lib/live-browser/session-manager";

export const runtime = "nodejs";

function getNetworkContext(request: NextRequest) {
  return {
    protocol: request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol,
    hostname:
      request.headers.get("x-forwarded-host") ??
      request.headers.get("host") ??
      request.nextUrl.hostname,
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const { sessionId } = await context.params;
  const session = getLiveBrowserSessionManager().getSession(
    auth.user.uid,
    sessionId
  );

  if (!session) {
    return NextResponse.json({ error: "Browser session not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    summary: session.currentUrl
      ? `Browser session is on ${session.currentUrl}.`
      : "Browser session is ready.",
    ...serializeLiveBrowserSession(session, getNetworkContext(request)),
  });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const { sessionId } = await context.params;
  const session = getLiveBrowserSessionManager().getSession(
    auth.user.uid,
    sessionId
  );

  if (!session) {
    return NextResponse.json({ error: "Browser session not found." }, { status: 404 });
  }

  await getLiveBrowserSessionManager().closeSession(sessionId);
  return NextResponse.json({ ok: true, status: "closed" });
}
