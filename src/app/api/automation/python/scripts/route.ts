import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import {
  createPythonSandboxScript,
  listPythonSandboxScripts,
} from "@/lib/automation/python/registry";
import { z } from "zod";

export const runtime = "nodejs";

const CreateScriptSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(5000).nullable().optional(),
  code: z.string().min(1).max(200000),
  entrypoint: z.string().trim().min(1).max(200).optional(),
  approvalState: z.enum(["draft", "approved"]).optional(),
  allowedDataScopes: z.array(z.string().trim().min(1)).optional(),
  allowNetwork: z.boolean().optional(),
  maxRuntimeSeconds: z.number().int().positive().max(900).optional(),
  maxMemoryMb: z.number().int().positive().max(2048).optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit");
    const approvalState = searchParams.get("approvalState");

    const scripts = await listPythonSandboxScripts(adminDb, auth.user.uid, {
      limit: limit ? Number(limit) : undefined,
      approvalState:
        approvalState === "draft" ||
        approvalState === "approved" ||
        approvalState === "archived"
          ? approvalState
          : approvalState === "all"
            ? "all"
            : undefined,
    });

    return NextResponse.json({ scripts });
  } catch (error) {
    console.error("Failed to list Python sandbox scripts:", error);
    return NextResponse.json(
      { error: "Failed to list Python sandbox scripts." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  try {
    const body = await request.json();
    const parsed = CreateScriptSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid Python sandbox script payload.",
          issues: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const script = await createPythonSandboxScript(
      adminDb,
      auth.user.uid,
      parsed.data
    );

    return NextResponse.json({ script }, { status: 201 });
  } catch (error) {
    console.error("Failed to create Python sandbox script:", error);
    return NextResponse.json(
      { error: "Failed to create Python sandbox script." },
      { status: 500 }
    );
  }
}
