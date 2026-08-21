import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { readJsonRecord } from "@/lib/api/request-body";
import { updateProcessSession } from "@/lib/work/processes";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const body = await readJsonRecord(request);
    const processSession = await updateProcessSession(adminDb, auth.user.uid, id, body);
    if (!processSession) {
      return NextResponse.json({ error: "Process not found." }, { status: 404 });
    }
    return NextResponse.json({ process: processSession });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update process.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
