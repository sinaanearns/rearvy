import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { sendChannelMessage } from "@/lib/work/channels";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 40000) : "";
  if (!text) {
    return NextResponse.json({ error: "Message text is required." }, { status: 400 });
  }

  const result = await sendChannelMessage(adminDb, auth.user.uid, id, text, {
    approved: body.approved === true,
  });
  if (!result) {
    return NextResponse.json({ error: "Channel connection not found." }, { status: 404 });
  }

  return NextResponse.json(result, { status: result.approvalRequired ? 202 : result.ok ? 200 : 400 });
}

