import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { createServerLogger } from "@/lib/server-logger";

export const runtime = "nodejs";

const log = createServerLogger("WorkRunsApi");

type RunListRecord = Record<string, unknown> & {
  id: string;
  source: string;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
};

function normalizeLimit(value: string | null) {
  const parsed = value ? Number(value) : 25;
  return Number.isFinite(parsed) ? Math.min(Math.max(Math.floor(parsed), 1), 50) : 25;
}

function readIsoString(value: unknown): string | null {
  if (typeof value === "string" && value) return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    try {
      const date = value.toDate();
      return date instanceof Date && !Number.isNaN(date.getTime())
        ? date.toISOString()
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

function runRecord(id: string, source: string, data: Record<string, unknown>): RunListRecord {
  return {
    ...data,
    id,
    source,
    created_at: readIsoString(data.created_at) ?? "",
    updated_at: readIsoString(data.updated_at) ?? "",
    started_at: readIsoString(data.started_at),
    finished_at: readIsoString(data.finished_at),
  };
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

    const workRuns = workRunsSnapshot.docs.map((doc) =>
      runRecord(doc.id, "work_automation", doc.data())
    );
    const agentRuns = agentRunsSnapshot.docs.map((doc) =>
      runRecord(doc.id, "agent_event", doc.data())
    );
    const teamRuns = teamRunsSnapshot.docs.map((doc) =>
      runRecord(doc.id, "work_team", doc.data())
    );
    const sourceTasks = sourceTasksSnapshot.docs.map((doc): RunListRecord => {
      const data = doc.data();
      return {
        ...runRecord(doc.id, "work_source", data),
        task: typeof data.query === "string" ? data.query : "",
      };
    });
    const runs = [...workRuns, ...agentRuns, ...teamRuns, ...sourceTasks]
      .filter((run) => (status ? String(run.status || "") === status : true))
      .sort((left, right) =>
        String(right.created_at || "").localeCompare(String(left.created_at || ""))
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
