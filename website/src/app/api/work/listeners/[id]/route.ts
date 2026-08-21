import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { readJsonRecord } from "@/lib/api/request-body";
import { archiveWorkListener, updateWorkListener } from "@/lib/work/listeners";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await readJsonRecord(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request body.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const listener = await updateWorkListener(adminDb, auth.user.uid, id, body);
  if (!listener) {
    return NextResponse.json({ error: "Listener not found." }, { status: 404 });
  }
  return NextResponse.json({ listener });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const listener = await archiveWorkListener(adminDb, auth.user.uid, id);
  if (!listener) {
    return NextResponse.json({ error: "Listener not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, listener });
}
