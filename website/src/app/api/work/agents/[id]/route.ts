import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { getWorkAgent, updateWorkAgent } from "@/lib/work/platform";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const agent = await getWorkAgent(adminDb, auth.user.uid, id);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  return NextResponse.json({ agent });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const agent = await updateWorkAgent(adminDb, auth.user.uid, id, body || {});
    if (!agent) {
      return NextResponse.json({ error: "Agent not found." }, { status: 404 });
    }

    return NextResponse.json({ agent });
  } catch (error) {
    console.error("Failed to update work agent:", error);
    return NextResponse.json(
      { error: "Failed to update work agent." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const agent = await getWorkAgent(adminDb, auth.user.uid, id);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  await adminDb.collection(COLLECTIONS.WORK_AGENTS).doc(id).set(
    {
      is_active: false,
      updated_at: new Date().toISOString(),
    },
    { merge: true }
  );

  return NextResponse.json({ ok: true });
}
