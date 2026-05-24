import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { enqueueAgentEvent } from "@/lib/agent-events/store";

function sanitizeChatId(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 160)
    : null;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const chatId = sanitizeChatId(body.chatId);

  if (!chatId) {
    return NextResponse.json({ error: "Missing chatId" }, { status: 400 });
  }

  const result = await enqueueAgentEvent(adminDb, {
    userId: auth.user.uid,
    type: "automation_trigger",
    source: "user_request",
    dedupeKey: `operations-start:${auth.user.uid}:${chatId}`,
    payload: {
      chatId,
      requestedFrom: "chat",
      runtime: "business-ops",
    },
    priority: 3,
  });

  return NextResponse.json({
    ok: true,
    success: true,
    runtime: "business-ops",
    mode: "event-driven",
    eventId: result.eventId,
    deduped: result.deduped,
    message:
      "Operations runtime is armed. Rearvy will wake for queued events, schedules, metric changes, anomalies, and approved automation.",
  });
}
