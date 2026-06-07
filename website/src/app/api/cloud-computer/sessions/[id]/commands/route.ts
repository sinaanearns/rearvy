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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await readJsonRecord(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request body.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const command = typeof body.command === "string" ? body.command.trim() : "";
  if (!command) {
    return NextResponse.json({ error: "Command required." }, { status: 400 });
  }

  const { sendCloudComputerCommand } = await import("@/lib/cloud-computer/service");
  const result = await sendCloudComputerCommand({
    userId: auth.user.uid,
    sessionId: id,
    command,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, status: result.status },
      { status: getResultStatusCode(result, 400) }
    );
  }

  return NextResponse.json({ ok: true, session: result.session });
}
