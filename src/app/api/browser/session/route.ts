import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { ensureLiveBrowserFrameServer } from "@/lib/live-browser/frame-server";
import { getLiveBrowserSessionManager } from "@/lib/live-browser/session-manager";
import { serializeLiveBrowserSession } from "@/lib/live-browser/presenter";
import { browserSessionCreateSchema } from "@/lib/live-browser/shared";

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

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const body = await request.json().catch(() => null);
  const parsed = browserSessionCreateSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    ensureLiveBrowserFrameServer();
    const manager = getLiveBrowserSessionManager();
    let session = await manager.createSession({
      userId: auth.user.uid,
      headless: parsed.data.headless,
      initialUrl: parsed.data.url ?? null,
    });

    let summary = session.currentUrl
      ? `Browser session opened ${session.currentUrl}.`
      : "Browser session started.";

    if (parsed.data.commands?.length) {
      const execution = await manager.executeCommands(
        auth.user.uid,
        session.sessionId,
        parsed.data.commands
      );
      session = execution.session;
      summary = execution.summary;
    }

    return NextResponse.json({
      ok: true,
      status: session.status,
      summary,
      ...serializeLiveBrowserSession(session, getNetworkContext(request)),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: toErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
