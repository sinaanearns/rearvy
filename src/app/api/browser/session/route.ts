import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { createSession } from "@/lib/browser-use/sessionManager";

export const runtime = "nodejs";

function getRequestHostname(request: NextRequest) {
  const hostHeader =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.hostname;
  return hostHeader.split(":")[0]?.toLowerCase() ?? "";
}

function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const hostname = getRequestHostname(request);
  const allowRemote = process.env.ALLOW_REMOTE_BROWSER_SESSION === "true";
  if (!isLocalHost(hostname) && !allowRemote) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "live_browser_local_only: Live browser sessions are currently available on localhost only. Run the app locally or set ALLOW_REMOTE_BROWSER_SESSION=true after provisioning a persistent browser worker.",
      },
      { status: 501 }
    );
  }

  try {
    const body = await request.json();
    const task = typeof body.task === "string" ? body.task : "";
    if (!task) {
      return NextResponse.json({ ok: false, error: "missing_task" }, { status: 400 });
    }

    const result = createSession(task);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({ ok: true, sessionId: result.id });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
