import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import { createServerLogger } from "@/lib/server-logger";
import { createWorkAgent, listWorkAgents } from "@/lib/work/platform";

export const runtime = "nodejs";

const log = createServerLogger("WorkAgentsApi");

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const agents = await listWorkAgents(adminDb, auth.user.uid);
    return NextResponse.json({ agents });
  } catch (error) {
    log.error("Failed to list work agents:", error);
    return NextResponse.json(
      { error: "Failed to list work agents." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await readJsonRecord(request);
    const agent = await createWorkAgent(adminDb, auth.user.uid, body);
    return NextResponse.json({ agent }, { status: 201 });
  } catch (error) {
    if (isRequestBodyError(error)) {
      const message = error instanceof Error ? error.message : "Invalid request body.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    log.error("Failed to create work agent:", error);
    return NextResponse.json(
      { error: "Failed to create work agent." },
      { status: 500 }
    );
  }
}
