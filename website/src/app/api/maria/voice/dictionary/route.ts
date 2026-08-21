import { NextResponse, type NextRequest } from "next/server";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { createDictionaryEntry, getVoiceContext, getVoiceTeamAccess } from "@/lib/maria/voice-store";
import { createServerLogger } from "@/lib/server-logger";

export const runtime = "nodejs";

const log = createServerLogger("MariaVoiceDictionaryRoute");

function readString(value: unknown, maxLength = 200) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : "";
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const context = await getVoiceContext(adminDb, auth.user.uid);
  return NextResponse.json({ ok: true, dictionary: context.dictionary, keyterms: context.keyterms });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const record = await readJsonRecord(request);
    const spoken = readString(record.spoken);
    const replacement = readString(record.replacement);

    if (!spoken || !replacement) {
      return NextResponse.json({ error: "Spoken phrase and replacement are required." }, { status: 400 });
    }

    if (record.scope === "team") {
      const teamId = readString(record.teamId || record.team_id);
      const access = teamId ? await getVoiceTeamAccess(adminDb, teamId, auth.user.uid) : null;
      if (!access?.canManage) {
        return NextResponse.json({ error: "Team admin access is required." }, { status: 403 });
      }
    }

    const entry = await createDictionaryEntry(adminDb, auth.user.uid, record);
    return NextResponse.json({ ok: true, entry }, { status: 201 });
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    log.error("Failed to create Maria dictionary entry:", error);
    return NextResponse.json({ error: "Failed to create dictionary entry." }, { status: 500 });
  }
}
