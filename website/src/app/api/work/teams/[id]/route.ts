import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { COLLECTIONS } from "@/lib/firebase/schema";

export const runtime = "nodejs";

function readString(value: unknown, fallback = "", maxLength = 1000) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : fallback;
}

async function getOwnedTeam(id: string, userId: string) {
  const ref = adminDb.collection(COLLECTIONS.WORK_AGENT_TEAMS).doc(id);
  const snap = await ref.get();
  const data = snap.data();
  if (!snap.exists || !data || data.user_id !== userId) {
    return null;
  }
  return { ref, data };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const owned = await getOwnedTeam(id, auth.user.uid);
  if (!owned) {
    return NextResponse.json({ error: "Team not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const patch = {
    name: readString(body?.name, String(owned.data.name || "Agent Team"), 140),
    description: readString(body?.description, "", 1000) || owned.data.description || null,
    workspace_path: readString(body?.workspacePath, "", 1000) || owned.data.workspace_path || null,
    is_active: typeof body?.isActive === "boolean" ? body.isActive : owned.data.is_active !== false,
    updated_at: new Date().toISOString(),
  };

  await owned.ref.set(patch, { merge: true });
  return NextResponse.json({ team: { id, ...owned.data, ...patch } });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const owned = await getOwnedTeam(id, auth.user.uid);
  if (!owned) {
    return NextResponse.json({ error: "Team not found." }, { status: 404 });
  }

  await owned.ref.set(
    {
      is_active: false,
      updated_at: new Date().toISOString(),
    },
    { merge: true }
  );
  return NextResponse.json({ ok: true });
}
