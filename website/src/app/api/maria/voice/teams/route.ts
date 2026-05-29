import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { createVoiceTeam, listVoiceMemberships, listVoiceTeams } from "@/lib/maria/voice-store";

export const runtime = "nodejs";

function readString(value: unknown, fallback = "", maxLength = 200) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : fallback;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const [teams, memberships] = await Promise.all([
      listVoiceTeams(adminDb, auth.user.uid),
      listVoiceMemberships(adminDb, auth.user.uid),
    ]);
    return NextResponse.json({ ok: true, teams, memberships });
  } catch (error) {
    console.error("Failed to list Maria voice teams:", error);
    return NextResponse.json({ error: "Failed to list teams." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json().catch(() => ({}));
    const name = readString(body?.name, "Maria Team", 160);
    const team = await createVoiceTeam(adminDb, auth.user.uid, name, auth.user.email);
    return NextResponse.json({ ok: true, team }, { status: 201 });
  } catch (error) {
    console.error("Failed to create Maria voice team:", error);
    return NextResponse.json({ error: "Failed to create team." }, { status: 500 });
  }
}
