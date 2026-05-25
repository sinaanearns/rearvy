import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { testChannelConnection } from "@/lib/work/channels";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const health = await testChannelConnection(adminDb, auth.user.uid, id);
  if (!health) {
    return NextResponse.json({ error: "Channel connection not found." }, { status: 404 });
  }
  return NextResponse.json({ health });
}

