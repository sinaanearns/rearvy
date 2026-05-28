import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { createWorkListener, listWorkListeners } from "@/lib/work/listeners";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const parsedLimit = Number(searchParams.get("limit") || 100);
  const limit = Number.isFinite(parsedLimit) ? parsedLimit : 100;
  const listeners = await listWorkListeners(adminDb, auth.user.uid, limit);
  return NextResponse.json({ listeners });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const listener = await createWorkListener(adminDb, auth.user.uid, body);
    return NextResponse.json({ listener }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create listener.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
