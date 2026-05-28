import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { createDiaryEntry, listDiaryEntries } from "@/lib/work/diary";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const parsedLimit = Number(searchParams.get("limit") || 30);
  const limit = Number.isFinite(parsedLimit) ? parsedLimit : 30;
  const entries = await listDiaryEntries(adminDb, auth.user.uid, limit);
  return NextResponse.json({ entries });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const entry = await createDiaryEntry(adminDb, auth.user.uid, body);
  return NextResponse.json({ entry }, { status: 201 });
}
