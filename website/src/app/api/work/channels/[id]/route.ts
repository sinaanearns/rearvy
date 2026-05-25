import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { deleteChannelConnection, getChannelConnection } from "@/lib/work/channels";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const connection = await getChannelConnection(adminDb, auth.user.uid, id);
  if (!connection) {
    return NextResponse.json({ error: "Channel connection not found." }, { status: 404 });
  }
  return NextResponse.json({ connection });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const deleted = await deleteChannelConnection(adminDb, auth.user.uid, id);
  if (!deleted) {
    return NextResponse.json({ error: "Channel connection not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

