import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { stopProcessSession } from "@/lib/work/processes";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const processSession = await stopProcessSession(adminDb, auth.user.uid, id);
  if (!processSession) {
    return NextResponse.json({ error: "Process not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, process: processSession });
}
