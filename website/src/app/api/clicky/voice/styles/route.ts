import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { createStyle, getVoiceContext, getVoiceTeamAccess } from "@/lib/clicky/voice-store";

export const runtime = "nodejs";

function readString(value: unknown, maxLength = 1000) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : "";
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const context = await getVoiceContext(adminDb, auth.user.uid);
  return NextResponse.json({ ok: true, styles: context.styles });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json().catch(() => ({}));
    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const name = readString(record.name, 120);
    const instructions = readString(record.instructions);

    if (!name || !instructions) {
      return NextResponse.json({ error: "Style name and instructions are required." }, { status: 400 });
    }

    if (record.scope === "team") {
      const teamId = readString(record.teamId || record.team_id, 200);
      const access = teamId ? await getVoiceTeamAccess(adminDb, teamId, auth.user.uid) : null;
      if (!access?.canManage) {
        return NextResponse.json({ error: "Team admin access is required." }, { status: 403 });
      }
    }

    const style = await createStyle(adminDb, auth.user.uid, record);
    return NextResponse.json({ ok: true, style }, { status: 201 });
  } catch (error) {
    console.error("Failed to create Clicky style:", error);
    return NextResponse.json({ error: "Failed to create style." }, { status: 500 });
  }
}
