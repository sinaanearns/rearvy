import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { writeAuditEvent } from "@/lib/audit/writer";
import { createServerLogger } from "@/lib/server-logger";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const log = createServerLogger("Api:AgentApproval");

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const auth = await requireAuth(req);
  if (auth.error) {
    return auth.error;
  }
  const userId = auth.user!.uid;
  const runId = params.id;

  try {
    const body = await req.json();
    const { action } = body;

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "Invalid approval action" }, { status: 400 });
    }

    const runRef = adminDb.collection(COLLECTIONS.AGENT_RUNS || "agent_runs").doc(runId);
    const doc = await runRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Agent run not found" }, { status: 404 });
    }

    const runData = doc.data()!;
    if (runData.user_id !== userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const nextState = action === "approve" ? "approved" : "rejected";
    const nextStatus = action === "approve" ? "running" : "cancelled";

    await runRef.update({
      approval_state: nextState,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    });

    // Write audit event for security tracking
    await writeAuditEvent({
      userId,
      category: "auth",
      action: `agent_approval_${action}`,
      resourceId: runId,
      severity: action === "approve" ? "medium" : "low",
      metadata: {
        persona: runData.persona,
        goal: runData.goal,
      },
    });

    log.info(`Agent run ${runId} ${action}d by boss ${userId}`);
    return NextResponse.json({ ok: true, approvalState: nextState });
  } catch (error) {
    log.error("Failed to process agent approval", error);
    return NextResponse.json({ error: "Approval processing failed" }, { status: 500 });
  }
}
