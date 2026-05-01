import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { sendCommandToSession, closeSession, getSession } from "@/lib/browser-use/sessionManager";

export const runtime = "nodejs";

function buildSessionSnapshot(sessionId: string) {
  const session = getSession(sessionId);
  if (!session) {
    return null;
  }

  const stdout = session.stdout.slice(-20);
  const stderr = session.stderr
    .filter((line) => !line.startsWith("__EXIT_CODE__:"))
    .slice(-20);
  const exitMarker = session.stderr.find((line) => line.startsWith("__EXIT_CODE__:"));
  const exitCode = exitMarker ? Number(exitMarker.replace("__EXIT_CODE__:", "")) : null;
  const status =
    session.child.exitCode === null && !session.child.killed
      ? "running"
      : exitCode === 0
        ? "completed"
        : exitCode === null
          ? "closed"
          : "failed";

  return {
    ok: true,
    sessionId: session.id,
    task: session.task,
    createdAt: session.createdAt,
    pid: session.child.pid ?? null,
    status,
    stdout,
    stderr,
    lastOutput: [...stdout, ...stderr].filter(Boolean).at(-1) ?? null,
    summary: `AI is controlling: ${session.task}`,
  };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  const snapshot = buildSessionSnapshot(sessionId);

  if (!snapshot) {
    return NextResponse.json({ ok: false, error: "session_not_found" }, { status: 404 });
  }

  return NextResponse.json(snapshot);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const { sessionId } = await context.params;
  try {
    const body = await request.json();
    const commands = Array.isArray(body.commands) ? body.commands : null;
    const directCmd =
      typeof body.cmd === "string"
        ? body.cmd
        : typeof body.command === "string"
          ? body.command
          : null;
    const cmd = commands && commands.length > 0
      ? JSON.stringify({ commands })
      : directCmd;

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

    const snapshot = buildSessionSnapshot(sessionId);
    if (snapshot) {
      return NextResponse.json(snapshot);
    }

    return NextResponse.json({ ok: true, sessionId, status: "running" });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
