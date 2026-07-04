import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { createServerLogger } from "@/lib/server-logger";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const log = createServerLogger("Api:Agents");

/** POST /api/agents - Create a new agent execution run */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) {
    return auth.error;
  }
  const userId = auth.user!.uid;

  try {
    const body = await req.json();
    const { personaName, taskId = null, goal = "" } = body;

    if (!personaName) {
      return NextResponse.json({ error: "Missing personaName" }, { status: 400 });
    }

    const runRef = adminDb.collection(COLLECTIONS.AGENT_RUNS || "agent_runs").doc();
    const runRecord = {
      id: runRef.id,
      user_id: userId,
      task_id: taskId,
      persona: personaName,
      goal,
      status: "running",
      approval_state: "not_required",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await runRef.set(runRecord);
    log.info(`Agent run registered: ${runRef.id} for persona ${personaName}`);
    return NextResponse.json({ ok: true, runId: runRef.id });
  } catch (error) {
    log.error("Failed to register agent run", error);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}

/** GET /api/agents - List active agent runs */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) {
    return auth.error;
  }
  const userId = auth.user!.uid;

  try {
    const snapshot = await adminDb
      .collection(COLLECTIONS.AGENT_RUNS || "agent_runs")
      .where("user_id", "==", userId)
      .orderBy("created_at", "desc")
      .limit(20)
      .get();

    const runs = snapshot.docs.map((doc) => doc.data());
    return NextResponse.json(runs);
  } catch (error) {
    log.error("Failed to list agent runs", error);
    return NextResponse.json({ error: "Listing failed" }, { status: 500 });
  }
}
