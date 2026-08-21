import { NextResponse, type NextRequest } from "next/server";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { getVoiceUsageSummary, recordVoiceUsage } from "@/lib/maria/voice-store";
import { createServerLogger } from "@/lib/server-logger";

export const runtime = "nodejs";

const log = createServerLogger("MariaVoiceUsageRoute");

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const summary = await getVoiceUsageSummary(adminDb, auth.user.uid);
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    log.error("Failed to load Maria voice usage:", error);
    return NextResponse.json({ error: "Failed to load usage." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await readJsonRecord(request);
    const event = await recordVoiceUsage(adminDb, auth.user.uid, body);
    return NextResponse.json({ ok: true, event }, { status: 201 });
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    log.error("Failed to record Maria voice usage:", error);
    return NextResponse.json({ error: "Failed to record usage." }, { status: 500 });
  }
}
