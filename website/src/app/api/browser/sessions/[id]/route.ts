import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  // First try in-memory (same process / same module instance)
  const { getSession, serializeSession } = await import("@/lib/browser-use/sessionManager");
  const session = getSession(id);

  if (session) {
    if (session.userId !== auth.user.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json(serializeSession(session));
  }

  // Turbopack may isolate route bundles – fall back to the file-based store
  const { readSession } = await import("@/lib/browser-use/session-store");
  const persisted = readSession(id);
  if (persisted) {
    if (persisted.userId !== auth.user.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json(persisted);
  }

  return NextResponse.json({ error: "Session not found" }, { status: 404 });
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
    const { sendCommandToSession } = await import("@/lib/browser-use/sessionManager");
    const result = sendCommandToSession(id, "stop");
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, status: "closing" });
  }

  const { sendCommandToSession } = await import("@/lib/browser-use/sessionManager");
  const result = sendCommandToSession(id, command);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { closeSession } = await import("@/lib/browser-use/sessionManager");
  const result = closeSession(id);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
