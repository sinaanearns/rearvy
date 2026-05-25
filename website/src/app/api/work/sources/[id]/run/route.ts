import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { rejectSourceTask, runSourceTask } from "@/lib/work/sources";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "approve";

  if (action === "reject") {
    const task = await rejectSourceTask(adminDb, auth.user.uid, id);
    if (!task) {
      return NextResponse.json({ error: "Source task not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, task });
  }

  if (action !== "approve" && action !== "run") {
    return NextResponse.json({ error: "Unsupported source task action." }, { status: 400 });
  }

  try {
    const task = await runSourceTask(adminDb, auth.user.uid, id);
    if (!task) {
      return NextResponse.json({ error: "Source task not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, task });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Source task failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

