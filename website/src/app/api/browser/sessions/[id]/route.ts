import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // First try in-memory (same process / same module instance)
  const { getSession } = await import("@/lib/browser-use/sessionManager");
  const session = getSession(id);

  if (session) {
    return NextResponse.json({
      id: session.id,
      task: session.task,
      createdAt: session.createdAt,
      stdout: session.stdout,
      stderr: session.stderr,
      isRunning: !session.child.killed,
    });
  }

  // Turbopack may isolate route bundles – fall back to the file-based store
  const { readSession } = await import("@/lib/browser-use/session-store");
  const persisted = readSession(id);
  if (persisted) {
    return NextResponse.json(persisted);
  }

  return NextResponse.json({ error: "Session not found" }, { status: 404 });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { command } = await req.json();

  if (!command) {
    return NextResponse.json({ error: "Command required" }, { status: 400 });
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
  const { closeSession } = await import("@/lib/browser-use/sessionManager");
  const result = closeSession(id);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
