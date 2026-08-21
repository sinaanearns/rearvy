import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { readJsonRecord } from "@/lib/api/request-body";
import {
  createSourceTask,
  getSourceCatalog,
  listSourceTasks,
} from "@/lib/work/sources";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const parsedLimit = Number(searchParams.get("limit") || 30);
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(Math.floor(parsedLimit), 1), 100)
    : 30;
  const { tasks, candidates } = await listSourceTasks(adminDb, auth.user.uid, limit);

  return NextResponse.json({
    catalog: getSourceCatalog(),
    tasks,
    candidates,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await readJsonRecord(request);
    const task = await createSourceTask(adminDb, auth.user.uid, body);
    if (!task) {
      return NextResponse.json({ error: "Source task could not be created." }, { status: 500 });
    }
    return NextResponse.json(
      {
        task,
        nextStep:
          task.status === "awaiting_approval"
            ? "Approve this public browser research task before execution."
            : "Source research started.",
      },
      { status: task.status === "awaiting_approval" ? 202 : 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create source task.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
