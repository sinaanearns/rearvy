import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { createWorkTask, listWorkTasks } from "@/lib/work/tasks";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const parsedLimit = Number(searchParams.get("limit") || 100);
  const limit = Number.isFinite(parsedLimit) ? parsedLimit : 100;
  const tasks = await listWorkTasks(adminDb, auth.user.uid, limit);
  return NextResponse.json({ tasks });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const task = await createWorkTask(adminDb, auth.user.uid, body);
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create task.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
