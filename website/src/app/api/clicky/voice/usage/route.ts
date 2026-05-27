import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { getVoiceUsageSummary, recordVoiceUsage } from "@/lib/clicky/voice-store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const summary = await getVoiceUsageSummary(adminDb, auth.user.uid);
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    console.error("Failed to load Clicky voice usage:", error);
    return NextResponse.json({ error: "Failed to load usage." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json().catch(() => ({}));
    const event = await recordVoiceUsage(
      adminDb,
      auth.user.uid,
      body && typeof body === "object" ? (body as Record<string, unknown>) : {}
    );
    return NextResponse.json({ ok: true, event }, { status: 201 });
  } catch (error) {
    console.error("Failed to record Clicky voice usage:", error);
    return NextResponse.json({ error: "Failed to record usage." }, { status: 500 });
  }
}
