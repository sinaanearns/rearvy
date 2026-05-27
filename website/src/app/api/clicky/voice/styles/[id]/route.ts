import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { deleteVoiceResource, updateVoiceResource } from "@/lib/clicky/voice-store";

export const runtime = "nodejs";

function sanitizePatch(body: unknown) {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const patch: Record<string, unknown> = {};
  for (const key of ["name", "category", "instructions", "enabled"]) {
    if (key in record) patch[key] = record[key];
  }
  return patch;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const style = await updateVoiceResource(
    adminDb,
    COLLECTIONS.CLICKY_VOICE_STYLES,
    id,
    auth.user.uid,
    sanitizePatch(body)
  );

  if (!style) {
    return NextResponse.json({ error: "Style not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, style });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const ok = await deleteVoiceResource(adminDb, COLLECTIONS.CLICKY_VOICE_STYLES, id, auth.user.uid);
  if (!ok) {
    return NextResponse.json({ error: "Style not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
