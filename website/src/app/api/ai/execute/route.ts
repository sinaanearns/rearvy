import { NextResponse, type NextRequest } from "next/server";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { executeGoal } from "@/lib/ai/execution/brain";
import type { ExecutionContext } from "@/lib/ai/execution/brain";
import { createServerLogger } from "@/lib/server-logger";

export const runtime = "nodejs";
export const maxDuration = 800;

const log = createServerLogger("ExecutionApi");

export async function POST(request: NextRequest) {
  const { user, error } = await requireAuth(request);
  if (error) {
    return error;
  }

  try {
    const payload = await readJsonRecord(request);
    const message = typeof payload.message === "string" ? payload.message.trim() : "";
    const projectId = typeof payload.projectId === "string" ? payload.projectId : null;
    const chatId = typeof payload.chatId === "string" ? payload.chatId : null;
    const isDesktopApp = payload.isDesktopApp === true;
    const approvalMode = typeof payload.approvalMode === "string" ? payload.approvalMode : "auto";
    const maxSteps = typeof payload.maxSteps === "number" && Number.isFinite(payload.maxSteps) ? Math.min(Math.max(payload.maxSteps, 1), 12) : 10;

    if (!message) {
      return NextResponse.json({ error: "message is required." }, { status: 400 });
    }

    const ctx: ExecutionContext = {
      userId: user.uid,
      projectId,
      chatId,
      isDesktopApp,
      allowedMcpServerIds: Array.isArray(payload.allowedMcpServerIds) ? payload.allowedMcpServerIds : null,
      allowedTools: Array.isArray(payload.allowedTools) ? payload.allowedTools : null,
    };

    const result = await executeGoal(message, ctx);

    if (result.needsApproval && approvalMode === "safe_only") {
      return NextResponse.json({
        ...result,
        summary: result.summary + " [Approval required]",
      });
    }

    return NextResponse.json({
      ...result,
      receivedAt: new Date().toISOString(),
    });
  } catch (routeError) {
    if (isRequestBodyError(routeError)) {
      return NextResponse.json({ error: routeError.message }, { status: 400 });
    }

    log.error("Execution API error:", routeError);
    return NextResponse.json(
      {
        error: "Execution failed.",
        detail: routeError instanceof Error ? routeError.message : String(routeError),
      },
      { status: 500 }
    );
  }
}
