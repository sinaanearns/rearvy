import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { createServerLogger } from "@/lib/server-logger";
import { runExecutiveRequest } from "@/lib/executive/engine";

export const runtime = "nodejs";

const log = createServerLogger("Api:Executive");

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const request = typeof body.request === "string" ? body.request.trim() : "";
    if (!request) {
      return NextResponse.json({ error: "Missing request." }, { status: 400 });
    }
    const result = await runExecutiveRequest({
      request,
      userId: auth.user!.uid,
      projectId: body.projectId ?? null,
      chatId: body.chatId ?? null,
      isDesktopApp: body.isDesktopApp === true,
      approvedStepIds: Array.isArray(body.approvedStepIds) ? body.approvedStepIds : [],
    });
    return NextResponse.json(result);
  } catch (error) {
    log.error("Executive execution failed", error);
    const message = error instanceof Error ? error.message : "Execution failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
