import { timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { runPendingAgentEvents } from "@/lib/agent-events/store";

export const runtime = "nodejs";

function secretsMatch(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function POST(request: NextRequest) {
  const workerSecret =
    process.env.WORK_RUNNER_SECRET ||
    process.env.WORK_SCHEDULER_SECRET ||
    process.env.AGENT_EVENTS_WORKER_SECRET ||
    process.env.SYNC_WORKER_SECRET ||
    "";

  if (!workerSecret) {
    return NextResponse.json(
      { error: "WORK_RUNNER_SECRET is not configured." },
      { status: 503 }
    );
  }

  const providedSecret =
    request.headers.get("x-work-runner-secret") ||
    request.headers.get("x-work-scheduler-secret") ||
    request.headers.get("x-agent-events-worker-secret") ||
    request.headers.get("x-sync-worker-secret");

  if (!secretsMatch(providedSecret, workerSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsedLimit = Number(searchParams.get("limit") || 10);
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(Math.floor(parsedLimit), 1), 25)
    : 10;

  const result = await runPendingAgentEvents(adminDb, { limit });
  return NextResponse.json({ ok: true, ...result });
}

