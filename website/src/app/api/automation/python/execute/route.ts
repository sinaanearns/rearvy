import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { queuePythonSandboxRun } from "@/lib/automation/python/registry";
import { createServerLogger } from "@/lib/server-logger";

export const runtime = "nodejs";

const log = createServerLogger("PythonAutomationExecuteRoute");

const QueueRunSchema = z.object({
  scriptId: z.string().trim().min(1).optional(),
  scriptName: z.string().trim().min(1).optional(),
  code: z.string().min(1).optional(),
  input: z.record(z.string(), z.unknown()).optional(),
  runtime: z
    .object({
      allowNetwork: z.boolean().optional(),
      maxRuntimeSeconds: z.number().int().positive().max(900).optional(),
      maxMemoryMb: z.number().int().positive().max(2048).optional(),
      allowedDataScopes: z.array(z.string().trim().min(1)).optional(),
    })
    .optional(),
  approvalRequired: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  try {
    const body = await readJsonRecord(request);
    const parsed = QueueRunSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid Python sandbox execution payload.",
          issues: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    if (!parsed.data.scriptId && !parsed.data.code) {
      return NextResponse.json(
        { error: "Provide either scriptId or code for execution." },
        { status: 400 }
      );
    }

    const run = await queuePythonSandboxRun(adminDb, auth.user.uid, {
      ...parsed.data,
      requestedBy: auth.user.uid,
    });

    return NextResponse.json(
      {
        ok: true,
        run,
        nextStep:
          run.status === "awaiting_approval"
            ? "Approval required before execution can begin."
            : "Run queued for execution.",
      },
      { status: run.status === "awaiting_approval" ? 202 : 201 }
    );
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    log.error("Failed to queue Python sandbox run:", error);
    return NextResponse.json(
      {
        error: "Failed to queue Python sandbox run.",
      },
      { status: 500 }
    );
  }
}
