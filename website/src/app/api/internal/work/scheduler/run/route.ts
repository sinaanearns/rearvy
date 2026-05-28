import { timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { runPendingAgentEvents } from "@/lib/agent-events/store";
import { scanDueWorkAutomations } from "@/lib/work/runtime";
import { scanDueWorkListeners } from "@/lib/work/listeners";

export const runtime = "nodejs";

function secretsMatch(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function getWorkerSecret() {
  return (
    process.env.WORK_SCHEDULER_SECRET ||
    process.env.AGENT_EVENTS_WORKER_SECRET ||
    process.env.SYNC_WORKER_SECRET ||
    ""
  );
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    runtime: "work-scheduler",
  });
}

export async function POST(request: NextRequest) {
  const workerSecret = getWorkerSecret();
  if (!workerSecret) {
    return NextResponse.json(
      { error: "WORK_SCHEDULER_SECRET is not configured." },
      { status: 503 }
    );
  }

  const providedSecret =
    request.headers.get("x-work-scheduler-secret") ||
    request.headers.get("x-agent-events-worker-secret") ||
    request.headers.get("x-sync-worker-secret");

  if (!secretsMatch(providedSecret, workerSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsedLimit = Number(searchParams.get("limit") || 25);
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(Math.floor(parsedLimit), 1), 100)
    : 25;

  const [scheduled, listeners] = await Promise.all([
    scanDueWorkAutomations(adminDb, { limit }),
    scanDueWorkListeners(adminDb, { limit }),
  ]);
  const events = await runPendingAgentEvents(adminDb, {
    limit: Math.min(limit, 25),
  });

  return NextResponse.json({
    ok: true,
    scheduled,
    listeners,
    events,
  });
}
