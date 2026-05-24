import { timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { runPendingAgentEvents } from "@/lib/agent-events/store";

function secretsMatch(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    runtime: "business-ops",
    mode: "event-driven",
  });
}

export async function POST(request: NextRequest) {
  const workerSecret =
    process.env.AGENT_EVENTS_WORKER_SECRET || process.env.SYNC_WORKER_SECRET;

  if (!workerSecret) {
    return NextResponse.json(
      { error: "AGENT_EVENTS_WORKER_SECRET is not configured" },
      { status: 503 }
    );
  }

  const providedSecret =
    request.headers.get("x-agent-events-worker-secret") ||
    request.headers.get("x-sync-worker-secret");

  if (!secretsMatch(providedSecret, workerSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawLimit = searchParams.get("limit");
  const parsedLimit = rawLimit ? Number(rawLimit) : undefined;
  const limit =
    parsedLimit && Number.isFinite(parsedLimit)
      ? Math.min(Math.max(Math.floor(parsedLimit), 1), 25)
      : 5;

  const result = await runPendingAgentEvents(adminDb, { limit });
  return NextResponse.json({ ok: true, ...result });
}
