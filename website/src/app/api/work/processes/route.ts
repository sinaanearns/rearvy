import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { readJsonRecord } from "@/lib/api/request-body";
import { createProcessSession, listProcessSessions } from "@/lib/work/processes";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const parsedLimit = Number(searchParams.get("limit") || 50);
  const limit = Number.isFinite(parsedLimit) ? parsedLimit : 50;
  const processes = await listProcessSessions(adminDb, auth.user.uid, limit);
  return NextResponse.json({ processes });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await readJsonRecord(request);
    const processSession = await createProcessSession(adminDb, auth.user.uid, body);
    return NextResponse.json({ process: processSession }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create process.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
