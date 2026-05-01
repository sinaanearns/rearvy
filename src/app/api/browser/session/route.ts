import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { createSession } from "@/lib/browser-use/sessionManager";

export const runtime = "nodejs";


export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
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
