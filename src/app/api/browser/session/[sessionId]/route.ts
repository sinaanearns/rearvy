import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../../lib/firebase/middleware";
import { getSession, closeSession } from "../../../../../lib/browser-use/sessionManager";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const { sessionId } = await context.params;
  const session = getSession(sessionId);

  if (!session) {
    return NextResponse.json({ error: "Browser session not found." }, { status: 404 });
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

  return NextResponse.json({
    ok: true,
    sessionId: session.id,
    task: session.task,
    createdAt: session.createdAt,
    pid: session.child.pid ?? null,
    status,
    stdout,
    stderr,
    lastOutput: [...stdout, ...stderr].filter(Boolean).at(-1) ?? null,
    summary: `Browser session: ${session.task}`,
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
  const session = getSession(sessionId);

  if (!session) {
    return NextResponse.json({ error: "Browser session not found." }, { status: 404 });
  }

  closeSession(sessionId);
  return NextResponse.json({ ok: true, status: "closed" });
}
