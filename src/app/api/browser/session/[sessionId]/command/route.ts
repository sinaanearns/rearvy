import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { sendCommandToSession, closeSession } from "@/lib/browser-use/sessionManager";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: { sessionId: string } }
) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const { sessionId } = context.params;
  try {
    const body = await request.json();
    const cmd = typeof body.cmd === "string" ? body.cmd : typeof body.command === "string" ? body.command : null;
    if (!cmd) {
      return NextResponse.json({ ok: false, error: "missing_command" }, { status: 400 });
    }

    // Support 'close' as shorthand to terminate the session
    if (cmd.trim().toLowerCase() === "close") {
      const res = closeSession(sessionId);
      if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 500 });
      return NextResponse.json({ ok: true, status: "closed" });
    }

    const result = sendCommandToSession(sessionId, cmd);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
