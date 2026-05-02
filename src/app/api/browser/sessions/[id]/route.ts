import { NextRequest, NextResponse } from "next/server";
import { getSession, closeSession, sendCommandToSession } from "@/lib/browser-use/sessionManager";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = getSession(id);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: session.id,
    task: session.task,
    createdAt: session.createdAt,
    stdout: session.stdout,
    stderr: session.stderr,
    isRunning: !session.child.killed,
  });
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
  const result = closeSession(id);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
