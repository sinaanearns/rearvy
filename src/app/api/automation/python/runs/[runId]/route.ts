import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import {
  cancelPythonSandboxRun,
  getPythonSandboxRun,
} from "@/lib/automation/python/registry";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const { runId } = await params;
  const run = await getPythonSandboxRun(adminDb, auth.user.uid, runId);

  if (!run) {
    return NextResponse.json({ error: "Run not found." }, { status: 404 });
  }

  return NextResponse.json({ run });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const { runId } = await params;
  const run = await cancelPythonSandboxRun(adminDb, auth.user.uid, runId);

  if (!run) {
    return NextResponse.json({ error: "Run not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, run });
}