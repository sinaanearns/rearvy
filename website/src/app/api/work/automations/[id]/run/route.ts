import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { createServerLogger } from "@/lib/server-logger";
import { queueWorkAutomationRun } from "@/lib/work/runtime";

export const runtime = "nodejs";

const log = createServerLogger("WorkAutomationRunApi");

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    const run = await queueWorkAutomationRun(adminDb, {
      userId: auth.user.uid,
      automationId: id,
      trigger: "manual",
    });

    if (!run) {
      return NextResponse.json({ error: "Automation not found." }, { status: 404 });
    }

    return NextResponse.json(
      {
        ok: true,
        run,
        eventId: run.agent_event_id,
        nextStep: run.status === "awaiting_approval"
          ? "Approval required before this automation can execute sensitive actions."
          : "Automation queued.",
      },
      { status: run.status === "awaiting_approval" ? 202 : 201 }
    );
  } catch (error) {
    log.error("Failed to run work automation:", error);
    return NextResponse.json(
      { error: "Failed to run work automation." },
      { status: 500 }
    );
  }
}
