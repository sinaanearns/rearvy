import { NextResponse, type NextRequest } from "next/server";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { createVoiceTeam, listVoiceMemberships, listVoiceTeams } from "@/lib/maria/voice-store";
import { createServerLogger } from "@/lib/server-logger";

export const runtime = "nodejs";

const log = createServerLogger("MariaVoiceTeamsRoute");

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
    log.error("Failed to list Maria voice teams:", error);
    return NextResponse.json({ error: "Failed to list teams." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await readJsonRecord(request);
    const name = readString(body.name, "Maria Team", 160);
    const team = await createVoiceTeam(adminDb, auth.user.uid, name, auth.user.email);
    return NextResponse.json({ ok: true, team }, { status: 201 });
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    log.error("Failed to create Maria voice team:", error);
    return NextResponse.json({ error: "Failed to create team." }, { status: 500 });
  }
}
