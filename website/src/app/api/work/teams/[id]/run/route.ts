import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import { runWorkTeam } from "@/lib/work/runtime";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    const body = await readJsonRecord(request);
    const task =
      typeof body.task === "string" && body.task.trim()
        ? body.task.trim().slice(0, 8000)
        : "Create a team work update.";
    const run = await runWorkTeam(adminDb, {
      userId: auth.user.uid,
      teamId: id,
      task,
    });

    return NextResponse.json({ ok: true, run }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to run Work team.";
    return NextResponse.json(
      { error: message },
      { status: isRequestBodyError(error) ? 400 : message === "Team not found." ? 404 : 500 }
    );
  }
}
