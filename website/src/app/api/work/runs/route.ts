import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { createServerLogger } from "@/lib/server-logger";

export const runtime = "nodejs";

const log = createServerLogger("WorkRunsApi");

function normalizeLimit(value: string | null) {
  const parsed = value ? Number(value) : 25;
  return Number.isFinite(parsed) ? Math.min(Math.max(Math.floor(parsed), 1), 50) : 25;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const limit = normalizeLimit(searchParams.get("limit"));
    const status = searchParams.get("status");
    const [workRunsSnapshot, agentRunsSnapshot, teamRunsSnapshot, sourceTasksSnapshot] = await Promise.all([
      adminDb
        .collection(COLLECTIONS.WORK_AUTOMATION_RUNS)
        .where("user_id", "==", auth.user.uid)
        .get(),
      adminDb
        .collection(COLLECTIONS.AGENT_RUNS)
        .where("user_id", "==", auth.user.uid)
        .get(),
      adminDb
        .collection(COLLECTIONS.WORK_TEAM_RUNS)
        .where("user_id", "==", auth.user.uid)
        .get(),
      adminDb
        .collection(COLLECTIONS.WORK_SOURCE_TASKS)
        .where("user_id", "==", auth.user.uid)
        .get(),
    ]);

    const workRuns = workRunsSnapshot.docs.map((doc) => ({
      id: doc.id,
      source: "work_automation",
      ...doc.data(),
    }));
    const agentRuns = agentRunsSnapshot.docs.map((doc) => ({
      id: doc.id,
      source: "agent_event",
      ...doc.data(),
    }));
    const teamRuns = teamRunsSnapshot.docs.map((doc) => ({
      id: doc.id,
      source: "work_team",
      ...doc.data(),
    }));
    const sourceTasks = sourceTasksSnapshot.docs.map((doc) => ({
      id: doc.id,
      source: "work_source",
      ...doc.data(),
      task: doc.data().query,
    }));
    const runs = [...workRuns, ...agentRuns, ...teamRuns, ...sourceTasks]
      .filter((run) => (status ? String((run as { status?: unknown }).status || "") === status : true))
      .sort((left, right) =>
        String((right as { created_at?: unknown }).created_at || "").localeCompare(
          String((left as { created_at?: unknown }).created_at || "")
        )
      )
      .slice(0, limit);

    return NextResponse.json({ runs });
  } catch (error) {
    log.error("Failed to list work runs:", error);
    return NextResponse.json(
      { error: "Failed to list work runs." },
      { status: 500 }
    );
  }
}
