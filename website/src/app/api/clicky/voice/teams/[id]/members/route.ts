import { NextResponse, type NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { getVoiceTeamAccess } from "@/lib/clicky/voice-store";

export const runtime = "nodejs";

function readString(value: unknown, fallback = "", maxLength = 240) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : fallback;
}

function normalizeRole(value: unknown) {
  return value === "admin" ? "admin" : "member";
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

  const snapshot = await adminDb
    .collection(COLLECTIONS.CLICKY_VOICE_TEAM_MEMBERS)
    .where("team_id", "==", id)
    .get();

  const members = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return NextResponse.json({ ok: true, members });
}

export async function POST(
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
  const email = readString(body?.email).toLowerCase();
  const role = normalizeRole(body?.role);
  if (!email) {
    return NextResponse.json({ error: "Member email is required." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const targetUser = await adminAuth.getUserByEmail(email).catch(() => null);
  if (!targetUser) {
    const inviteRef = adminDb.collection(COLLECTIONS.CLICKY_VOICE_TEAM_INVITES).doc();
    const invite = {
      team_id: id,
      email,
      role,
      invited_by: auth.user.uid,
      status: "pending",
      created_at: now,
      updated_at: now,
    };
    await inviteRef.set(invite);
    return NextResponse.json({ ok: true, invite: { id: inviteRef.id, ...invite } }, { status: 202 });
  }

  const existing = await adminDb
    .collection(COLLECTIONS.CLICKY_VOICE_TEAM_MEMBERS)
    .where("team_id", "==", id)
    .where("user_id", "==", targetUser.uid)
    .limit(1)
    .get();
  const memberRef = existing.docs[0]?.ref || adminDb.collection(COLLECTIONS.CLICKY_VOICE_TEAM_MEMBERS).doc();
  const member = {
    team_id: id,
    user_id: targetUser.uid,
    email,
    role,
    created_at: existing.docs[0]?.data()?.created_at || now,
    updated_at: now,
  };

  await memberRef.set(member, { merge: true });
  return NextResponse.json({ ok: true, member: { id: memberRef.id, ...member } }, { status: existing.empty ? 201 : 200 });
}
