import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { createServerLogger } from "@/lib/server-logger";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import { MultiMcpOrchestrator } from "@/lib/ai/mcp/orchestrator";

const log = createServerLogger("ApiMcpOrchestrate");

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (error) return error;

    const body = await readJsonRecord(request);
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const desktopHeader = request.headers.get("x-rearvy-desktop") || "";
    const isDesktopApp =
      body.isDesktopApp === true || desktopHeader === "1" || desktopHeader.toLowerCase() === "true";

    if (!prompt) {
      return NextResponse.json({ error: "Missing prompt field" }, { status: 400 });
    }

    const orchestration = await MultiMcpOrchestrator.orchestrateGoal({
      userId: user.uid,
      prompt,
      orgId: typeof body.orgId === "string" ? body.orgId : null,
      isDesktopApp,
      allowedMcpServerIds: Array.isArray(body.allowedMcpServerIds)
        ? body.allowedMcpServerIds.filter((value): value is string => typeof value === "string")
        : null,
    });

    return NextResponse.json(orchestration);
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    log.error("Orchestration error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (error) return error;

    const snapshot = await adminDb
      .collection(COLLECTIONS.WORKFLOW_EXECUTIONS)
      .where("user_id", "==", user.uid)
      .limit(20)
      .get();

    const executions = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ executions });
  } catch (error) {
    log.error("Executions GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
