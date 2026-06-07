import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { readJsonRecord } from "@/lib/api/request-body";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { listUnifiedBrowserSessions } = await import(
    "@/lib/browser-use/unifiedSessionManager"
  );
  const sessions = await listUnifiedBrowserSessions(auth.user.uid);

  return NextResponse.json({
    sessions,
    localRuntime: !process.env.VERCEL,
    cloudRuntime: process.env.CLOUD_COMPUTER_ENABLED === "true",
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
    body?.connectionMethod === "cloud-browser" ||
    body?.connectionMethod === "auto"
      ? body.connectionMethod
      : "auto";
  const { createUnifiedBrowserSession } = await import(
    "@/lib/browser-use/unifiedSessionManager"
  );
  const result = await createUnifiedBrowserSession(task, auth.user.uid, {
    connectionMethod,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.code || 400 }
    );
  }

  return NextResponse.json(
    { ok: true, id: result.id, session: result.session },
    { status: 201 }
  );
}
