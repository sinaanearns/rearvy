import { NextResponse, type NextRequest } from "next/server";
import { isRecord, isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { deleteVoiceResource, updateVoiceResource } from "@/lib/maria/voice-store";

export const runtime = "nodejs";

function sanitizePatch(body: unknown) {
  const record = isRecord(body) ? body : {};
  const patch: Record<string, unknown> = {};
  for (const key of ["trigger", "expansion", "priority", "enabled"]) {
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
  let body: Record<string, unknown>;
  try {
    body = await readJsonRecord(request);
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    throw error;
  }

  const snippet = await updateVoiceResource(
    adminDb,
    COLLECTIONS.MARIA_VOICE_SNIPPETS,
    id,
    auth.user.uid,
    sanitizePatch(body)
  );

  if (!snippet) {
    return NextResponse.json({ error: "Snippet not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, snippet });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const ok = await deleteVoiceResource(adminDb, COLLECTIONS.MARIA_VOICE_SNIPPETS, id, auth.user.uid);
  if (!ok) {
    return NextResponse.json({ error: "Snippet not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
