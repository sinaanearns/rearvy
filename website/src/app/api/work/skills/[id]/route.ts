import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { COLLECTIONS } from "@/lib/firebase/schema";

export const runtime = "nodejs";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const ref = adminDb.collection(COLLECTIONS.WORK_AGENT_SKILLS).doc(id);
  const snap = await ref.get();
  const data = snap.data();
  if (!snap.exists || !data || data.user_id !== auth.user.uid) {
    return NextResponse.json({ error: "Skill not found." }, { status: 404 });
  }

  await ref.delete();
  return NextResponse.json({ ok: true });
}
