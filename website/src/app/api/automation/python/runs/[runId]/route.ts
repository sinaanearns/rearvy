import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import {
  approvePythonSandboxRun,
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const { runId } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "";

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json(
      { error: "Unsupported Python sandbox run action." },
      { status: 400 }
    );
  }

  const run =
    action === "approve"
      ? await approvePythonSandboxRun(adminDb, auth.user.uid, runId, auth.user.uid)
      : await cancelPythonSandboxRun(adminDb, auth.user.uid, runId);

  if (!run) {
    return NextResponse.json({ error: "Run not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, run });
}
