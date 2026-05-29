import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { getVoiceTeamAccess } from "@/lib/maria/voice-store";

export const runtime = "nodejs";

function normalizeSettings(body: Record<string, unknown>, existing: Record<string, unknown>) {
  const current = existing.settings && typeof existing.settings === "object"
    ? (existing.settings as Record<string, unknown>)
    : {};

  const retentionMode =
    body.retentionMode === "metadata" || body.retentionMode === "transcripts" || body.retentionMode === "off"
      ? body.retentionMode
      : current.retentionMode || current.retention_mode || "off";

  return {
    contextAwarenessEnabled:
      typeof body.contextAwarenessEnabled === "boolean"
        ? body.contextAwarenessEnabled
        : current.contextAwarenessEnabled ?? current.context_awareness_enabled ?? true,
    retentionMode,
    usageAnalyticsVisible:
      typeof body.usageAnalyticsVisible === "boolean"
        ? body.usageAnalyticsVisible
        : current.usageAnalyticsVisible ?? current.usage_analytics_visible ?? true,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const access = await getVoiceTeamAccess(adminDb, id, auth.user.uid);
  if (!access) {
    return NextResponse.json({ error: "Team not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, settings: access.team.settings, team: access.team });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const access = await getVoiceTeamAccess(adminDb, id, auth.user.uid);
  if (!access?.canManage) {
    return NextResponse.json({ error: "Team admin access is required." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const ref = adminDb.collection(COLLECTIONS.MARIA_VOICE_TEAMS).doc(id);
  const snap = await ref.get();
  const data = snap.data() || {};
  const settings = normalizeSettings(record, data);
  await ref.set({ settings, updated_at: new Date().toISOString() }, { merge: true });

  return NextResponse.json({ ok: true, settings });
}
