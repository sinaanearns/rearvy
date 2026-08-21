import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { runWorkListener } from "@/lib/work/listeners";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const listener = await runWorkListener(adminDb, auth.user.uid, id);
    if (!listener) {
      return NextResponse.json({ error: "Listener not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, listener });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Listener run failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
