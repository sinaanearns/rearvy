import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { serializeLiveBrowserSession } from "@/lib/live-browser/presenter";
import { getLiveBrowserSessionManager } from "@/lib/live-browser/session-manager";
import { browserSessionCommandRequestSchema } from "@/lib/live-browser/shared";

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

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const body = await request.json().catch(() => null);
  const parsed = browserSessionCommandRequestSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const { sessionId } = await context.params;
    const commands = parsed.data.commands ?? [parsed.data.command!];
    const result = await getLiveBrowserSessionManager().executeCommands(
      auth.user.uid,
      sessionId,
      commands
    );

    return NextResponse.json({
      ok: result.ok,
      status: result.session.status,
      summary: result.summary,
      ...serializeLiveBrowserSession(result.session, getNetworkContext(request)),
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
