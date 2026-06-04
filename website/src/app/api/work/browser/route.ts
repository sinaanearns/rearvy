import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { readJsonRecord } from "@/lib/api/request-body";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { listSessions, serializeSession } = await import("@/lib/browser-use/sessionManager");
  const { listPersistedSessions } = await import("@/lib/browser-use/session-store");
  const liveSessions = listSessions().map(serializeSession);
  const byId = new Map(
    [...listPersistedSessions(), ...liveSessions]
      .filter((session) => session.userId === auth.user.uid)
      .map((session) => [session.id, session])
  );
  const sessions = Array.from(byId.values())
    .sort((left, right) => right.createdAt - left.createdAt);

  return NextResponse.json({
    sessions,
    localRuntime: !process.env.VERCEL,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await readJsonRecord(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request body.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const task = typeof body?.task === "string" ? body.task.trim() : "";
  if (!task) {
    return NextResponse.json({ error: "Browser task is required." }, { status: 400 });
  }

  const connectionMethod =
    body?.connectionMethod === "cdp-direct" ||
    body?.connectionMethod === "extension-relay" ||
    body?.connectionMethod === "managed-runner" ||
    body?.connectionMethod === "auto"
      ? body.connectionMethod
      : "auto";
  const { createSession } = await import("@/lib/browser-use/sessionManager");
  const result = await createSession(task, auth.user.uid, {
    connectionMethod,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
}
