import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import {
  archivePythonSandboxScript,
  getPythonSandboxScript,
  updatePythonSandboxScript,
} from "@/lib/automation/python/registry";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import { createServerLogger } from "@/lib/server-logger";
import { z } from "zod";

export const runtime = "nodejs";

const log = createServerLogger("PythonAutomationScriptRoute");

const UpdateScriptSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  code: z.string().min(1).max(200000).optional(),
  entrypoint: z.string().trim().min(1).max(200).nullable().optional(),
  approvalState: z.enum(["draft", "approved", "archived"]).optional(),
  allowedDataScopes: z.array(z.string().trim().min(1)).optional(),
  allowNetwork: z.boolean().optional(),
  maxRuntimeSeconds: z.number().int().positive().max(900).optional(),
  maxMemoryMb: z.number().int().positive().max(2048).optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ scriptId: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const { scriptId } = await params;
  const script = await getPythonSandboxScript(adminDb, auth.user.uid, scriptId);

  if (!script) {
    return NextResponse.json({ error: "Script not found." }, { status: 404 });
  }

  return NextResponse.json({ script });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ scriptId: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const { scriptId } = await params;

  try {
    const body = await readJsonRecord(request);
    const parsed = UpdateScriptSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid Python sandbox script payload.",
          issues: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const script = await updatePythonSandboxScript(
      adminDb,
      auth.user.uid,
      scriptId,
      parsed.data
    );

    if (!script) {
      return NextResponse.json({ error: "Script not found." }, { status: 404 });
    }

    return NextResponse.json({ script });
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    log.error("Failed to update Python sandbox script:", error);
    return NextResponse.json(
      { error: "Failed to update Python sandbox script." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ scriptId: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const { scriptId } = await params;
  const script = await archivePythonSandboxScript(adminDb, auth.user.uid, scriptId);

  if (!script) {
    return NextResponse.json({ error: "Script not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, scriptId, script });
}
