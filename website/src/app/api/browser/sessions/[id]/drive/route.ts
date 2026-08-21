import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { createServerLogger } from "@/lib/server-logger";
import { readSession } from "@/lib/browser-use/session-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const log = createServerLogger("BrowserDriveRoute");

/**
 * POST /api/browser/sessions/:id/drive
 *
 * Starts or resumes the AI-driven browser loop for a live Firecrawl session.
 *
 * Request body:
 *   { goal: string, maxSteps?: number, resumeApprovalId?: string }
 *
 * Response: Server-Sent Events (SSE) stream.
 *   Each event is a JSON object with type: "step_start" | "step_done" | "approval_required" | "done" | "error" | "progress"
 *
 * The client can watch the browser being driven step-by-step in real time
 * while the BrowserLiveViewer iframe shows the live browser.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  let body: { goal?: string; maxSteps?: number; resumeApprovalId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const goal = typeof body.goal === "string" ? body.goal.trim() : "";
  const maxSteps = typeof body.maxSteps === "number" ? Math.min(Math.max(body.maxSteps, 1), 25) : 15;
  const resumeApprovalId = typeof body.resumeApprovalId === "string" ? body.resumeApprovalId : null;

  if (!goal) {
    return NextResponse.json({ error: "goal is required" }, { status: 400 });
  }

  // Verify session exists and belongs to this user
  const existingSession = readSession(sessionId);

  // For Firecrawl sessions, also check in-memory via unified manager
  if (!existingSession) {
    // Try to look it up via the unified session manager
    const { getUnifiedBrowserSession } = await import("@/lib/browser-use/unifiedSessionManager");
    const lookup = await getUnifiedBrowserSession({ sessionId, userId: auth.user.uid });
    if (!lookup.ok) {
      return NextResponse.json({ error: "Session not found or unauthorized" }, { status: 404 });
    }
  } else if (existingSession.userId && existingSession.userId !== auth.user.uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  log.info(`[BrowserDriveRoute] Starting drive for session ${sessionId}`, {
    goal: goal.slice(0, 80),
    maxSteps,
    resumeApprovalId,
  });

  // ---------------------------------------------------------------------------
  // SSE stream setup
  // ---------------------------------------------------------------------------

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  function sendEvent(data: Record<string, unknown>) {
    const jsonLine = `data: ${JSON.stringify(data)}\n\n`;
    writer.write(encoder.encode(jsonLine)).catch(() => {});
  }

  function sendClose() {
    writer.close().catch(() => {});
  }

  // Run the drive loop asynchronously, piping events to SSE
  (async () => {
    try {
      const { driveBrowserSession, resumeAfterApproval } = await import(
        "@/lib/browser-use/browserDriveEngine"
      );

      const driveOptions = {
        maxSteps,
        isDesktopApp: false,
        onUpdate: async (update: Record<string, unknown>) => {
          sendEvent(update);
        },
      };

      let result;

      if (resumeApprovalId) {
        // Resume after user approved a sensitive action
        result = await resumeAfterApproval(
          sessionId,
          resumeApprovalId,
          goal,
          auth.user.uid,
          driveOptions
        );
      } else {
        // Start fresh drive loop
        result = await driveBrowserSession(sessionId, goal, auth.user.uid, driveOptions);
      }

      // Final summary event
      sendEvent({
        type: "final_result",
        ok: result.ok,
        summary: result.summary,
        stepsCompleted: result.stepsCompleted,
        finalUrl: result.finalUrl,
        finalTitle: result.finalTitle,
        needsApproval: result.needsApproval,
        approvalId: result.approvalId,
        approvalReason: result.approvalReason,
        error: result.error,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log.error(`[BrowserDriveRoute] Drive loop crashed for session ${sessionId}:`, err);
      sendEvent({ type: "error", error: `Drive loop failed: ${errMsg}` });
    } finally {
      sendClose();
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
