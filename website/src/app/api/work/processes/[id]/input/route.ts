import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { queueProcessInput } from "@/lib/work/processes";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const text = typeof body.text === "string" ? body.text : "";
    if (!text.trim()) {
      return NextResponse.json({ error: "Input text is required." }, { status: 400 });
    }
    const processSession = await queueProcessInput(adminDb, auth.user.uid, id, text);
    if (!processSession) {
      return NextResponse.json({ error: "Process not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, process: processSession });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send process input.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
