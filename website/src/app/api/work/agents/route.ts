import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { createWorkAgent, listWorkAgents } from "@/lib/work/platform";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const agents = await listWorkAgents(adminDb, auth.user.uid);
    return NextResponse.json({ agents });
  } catch (error) {
    console.error("Failed to list work agents:", error);
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
    const body = await request.json();
    const agent = await createWorkAgent(adminDb, auth.user.uid, body || {});
    return NextResponse.json({ agent }, { status: 201 });
  } catch (error) {
    console.error("Failed to create work agent:", error);
    return NextResponse.json(
      { error: "Failed to create work agent." },
      { status: 500 }
    );
  }
}
