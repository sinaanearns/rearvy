import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { MultiMcpOrchestrator } from "@/lib/ai/mcp/orchestrator";
import { createServerLogger } from "@/lib/server-logger";

export const runtime = "nodejs";
export const maxDuration = 300;

const log = createServerLogger("ApproveConnectorWorkflowStepApi");

export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ executionId: string; stepId: string }>;
  }
) {
  const { user, error } = await requireAuth(request);
  if (error) return error;

  try {
    const { executionId, stepId } = await params;
    const desktopHeader = request.headers.get("x-rearvy-desktop") || "";
    const isDesktopApp = desktopHeader === "1" || desktopHeader.toLowerCase() === "true";
    const result = await MultiMcpOrchestrator.approveStep({
      executionId,
      stepId,
      userId: user.uid,
      isDesktopApp,
    });

    return NextResponse.json(result);
  } catch (approvalError) {
    const message = approvalError instanceof Error ? approvalError.message : String(approvalError);
    if (/not found/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (/not owned/i.test(message)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (/only a step awaiting approval/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 409 });
    }

    log.error("Workflow step approval failed:", approvalError);
    return NextResponse.json({ error: "Unable to approve workflow step." }, { status: 500 });
  }
}
