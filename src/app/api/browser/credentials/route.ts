import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "../../../../lib/firebase/admin";
import { getUserFromRequest } from "../../../../lib/firebase/server";
import { saveBrowserCredentialRecord } from "../../../../lib/browser-use/credentials";

export async function POST(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const label =
      typeof body.label === "string" ? body.label.trim() : "";
    const service =
      typeof body.service === "string" ? body.service.trim() : "website";
    const login =
      typeof body.login === "string" ? body.login.trim() : "";
    const password =
      typeof body.password === "string" ? body.password : "";
    const remember = body.remember !== false;
    const notes =
      typeof body.notes === "string" && body.notes.trim()
        ? body.notes.trim()
        : null;
    const projectId =
      typeof body.projectId === "string" && body.projectId.trim()
        ? body.projectId.trim()
        : null;

    if (!label || !login || !password) {
      return NextResponse.json(
        { error: "Label, login, and password are required." },
        { status: 400 }
      );
    }

    const result = await saveBrowserCredentialRecord({
      adminDb,
      userId: data.user.id,
      label,
      service,
      login,
      password,
      notes,
      projectId,
      persistent: remember,
      saveMemory: remember,
    });

    return NextResponse.json({
      ok: true,
      saved: true,
      label: result.label,
      service: result.service,
      loginMask: result.loginMask,
      memorySaved: result.memorySaved,
      suggestedPrompt: `Continue the browser task using saved browser credential label "${result.label}".`,
    });
  } catch (error) {
    console.error("Failed to save browser credential:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save browser credential.",
      },
      { status: 500 }
    );
  }
}
