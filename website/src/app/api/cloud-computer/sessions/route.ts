import { NextRequest, NextResponse } from "next/server";
import { readJsonRecord } from "@/lib/api/request-body";
import { requireAuth } from "@/lib/firebase/middleware";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getResultStatusCode(result: unknown, fallback: number) {
  if (!result || typeof result !== "object" || !("code" in result)) {
    return fallback;
  }

  return typeof result.code === "number" ? result.code : fallback;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { listCloudComputerSessionsForUser } = await import(
    "@/lib/cloud-computer/service"
  );
  const sessions = await listCloudComputerSessionsForUser(auth.user.uid);

  return NextResponse.json({ sessions });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await readJsonRecord(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request body.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const task = typeof body.task === "string" ? body.task.trim() : "";
  if (!task) {
    return NextResponse.json({ error: "Browser task is required." }, { status: 400 });
  }

  const strategy = body.strategy === "open-only" ? "open-only" : "goal-seeking";
  const { startCloudComputerSession } = await import("@/lib/cloud-computer/service");
  const result = await startCloudComputerSession({
    userId: auth.user.uid,
    task,
    strategy,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, status: result.status },
      { status: getResultStatusCode(result, 400) }
    );
  }

  return NextResponse.json({ ok: true, session: result.session }, { status: 201 });
}
