import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { runPendingAgentEvents } from "@/lib/agent-events/store";
import { scanDueWorkAutomations } from "@/lib/work/runtime";
import { scanDueWorkListeners } from "@/lib/work/listeners";
import {
  isWorkSchedulerRequestAuthorized,
  normalizeSchedulerLimit,
} from "@/lib/work/scheduler-auth";

export const runtime = "nodejs";

function getWorkerSecret() {
  return (
    process.env.WORK_SCHEDULER_SECRET ||
    process.env.AGENT_EVENTS_WORKER_SECRET ||
    process.env.SYNC_WORKER_SECRET ||
    ""
  );
}

async function runWorkScheduler(limit: number) {
  const [scheduled, listeners] = await Promise.all([
    scanDueWorkAutomations(adminDb, { limit }),
    scanDueWorkListeners(adminDb, { limit }),
  ]);
  const events = await runPendingAgentEvents(adminDb, {
    limit: Math.min(limit, 25),
  });

  return {
    ok: true,
    scheduled,
    listeners,
    events,
  };
}

export async function GET(request: NextRequest) {
  const shouldRun =
    request.nextUrl.searchParams.get("run") === "1" ||
    request.nextUrl.searchParams.get("execute") === "1";

  if (!shouldRun) {
    return NextResponse.json({
      ok: true,
      runtime: "work-scheduler",
    });
  }

  const workerSecret = getWorkerSecret();
  if (!workerSecret) {
    return NextResponse.json(
      { error: "WORK_SCHEDULER_SECRET is not configured." },
      { status: 503 }
    );
  }

  if (!isWorkSchedulerRequestAuthorized(request, workerSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = normalizeSchedulerLimit(request.nextUrl.searchParams.get("limit"));
  return NextResponse.json(await runWorkScheduler(limit));
}

export async function POST(request: NextRequest) {
  const workerSecret = getWorkerSecret();
  if (!workerSecret) {
    return NextResponse.json(
      { error: "WORK_SCHEDULER_SECRET is not configured." },
      { status: 503 }
    );
  }

  if (!isWorkSchedulerRequestAuthorized(request, workerSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = normalizeSchedulerLimit(searchParams.get("limit"));
  return NextResponse.json(await runWorkScheduler(limit));
}
