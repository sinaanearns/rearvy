import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getResultStatusCode(result: unknown, fallback: number) {
  if (!result || typeof result !== "object" || !("code" in result)) {
    return fallback;
  }

  return typeof result.code === "number" ? result.code : fallback;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { getUnifiedBrowserSession } = await import(
    "@/lib/browser-use/unifiedSessionManager"
  );
  const result = await getUnifiedBrowserSession({
    sessionId: id,
    userId: auth.user.uid,
    includeLiveView: true,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: getResultStatusCode(result, 404) }
    );
  }

  return NextResponse.json(result.session);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { command } = await req.json();

  if (!command) {
    return NextResponse.json({ error: "Command required" }, { status: 400 });
  }

  const normalizedCommand = String(command).trim().toLowerCase();
  if (["stop", "close", "exit", "quit"].includes(normalizedCommand)) {
    const { closeUnifiedBrowserSession } = await import(
      "@/lib/browser-use/unifiedSessionManager"
    );
    const result = await closeUnifiedBrowserSession({
      sessionId: id,
      userId: auth.user.uid,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: getResultStatusCode(result, 400) }
      );
    }

    return NextResponse.json({ ok: true, status: "closing" });
  }

  const { sendCommandToUnifiedBrowserSession } = await import(
    "@/lib/browser-use/unifiedSessionManager"
  );
  const result = await sendCommandToUnifiedBrowserSession({
    sessionId: id,
    userId: auth.user.uid,
    command,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: getResultStatusCode(result, 400) }
    );
  }

  return NextResponse.json({ ok: true, session: "session" in result ? result.session : null });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { closeUnifiedBrowserSession } = await import(
    "@/lib/browser-use/unifiedSessionManager"
  );
  const result = await closeUnifiedBrowserSession({
    sessionId: id,
    userId: auth.user.uid,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: getResultStatusCode(result, 400) }
    );
  }

  return NextResponse.json({ ok: true });
}
