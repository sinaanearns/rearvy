import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { getWorkAgent } from "@/lib/work/platform";

export const runtime = "nodejs";

function readString(value: unknown, fallback = "", maxLength = 1000) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : fallback;
}

function normalizeMode(value: unknown) {
  return value === "parallel" || value === "review" || value === "coordinator"
    ? value
    : "coordinator";
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const [teamsSnapshot, membersSnapshot] = await Promise.all([
      adminDb
        .collection(COLLECTIONS.WORK_AGENT_TEAMS)
        .where("user_id", "==", auth.user.uid)
        .get(),
      adminDb
        .collection(COLLECTIONS.WORK_TEAM_MEMBERS)
        .where("user_id", "==", auth.user.uid)
        .get(),
    ]);

    const membersByTeam = new Map<string, unknown[]>();
    for (const doc of membersSnapshot.docs) {
      const data = { id: doc.id, ...doc.data() };
      const teamId = String((data as { team_id?: unknown }).team_id || "");
      if (!teamId) continue;
      membersByTeam.set(teamId, [...(membersByTeam.get(teamId) || []), data]);
    }

    const teams = teamsSnapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
        members: membersByTeam.get(doc.id) || [],
      }))
      .sort((left, right) =>
        String((right as { updated_at?: unknown }).updated_at || "").localeCompare(
          String((left as { updated_at?: unknown }).updated_at || "")
        )
      );

    return NextResponse.json({ teams });
  } catch (error) {
    console.error("Failed to list work teams:", error);
    return NextResponse.json(
      { error: "Failed to list work teams." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const leadAgentId = readString(body?.leadAgentId);
    if (!leadAgentId) {
      return NextResponse.json({ error: "Lead agent is required." }, { status: 400 });
    }

    const leadAgent = await getWorkAgent(adminDb, auth.user.uid, leadAgentId);
    if (!leadAgent) {
      return NextResponse.json({ error: "Lead agent not found." }, { status: 404 });
    }

    const memberAgentIds = Array.isArray(body?.memberAgentIds)
      ? Array.from(
          new Set(
            body.memberAgentIds
              .filter((value: unknown): value is string => typeof value === "string")
              .map((value: string) => value.trim())
              .filter(Boolean)
          )
        ).slice(0, 10)
      : [];
    const now = new Date().toISOString();
    const teamRef = adminDb.collection(COLLECTIONS.WORK_AGENT_TEAMS).doc();
    const team = {
      user_id: auth.user.uid,
      name: readString(body?.name, "Agent Team", 140),
      description: readString(body?.description, "", 1000) || null,
      lead_agent_id: leadAgentId,
      project_id: readString(body?.projectId, "", 200) || null,
      workspace_path: readString(body?.workspacePath, "", 1000) || null,
      mode: normalizeMode(body?.mode),
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    const batch = adminDb.batch();
    batch.set(teamRef, team);
    const leadMemberRef = adminDb.collection(COLLECTIONS.WORK_TEAM_MEMBERS).doc();
    batch.set(leadMemberRef, {
      user_id: auth.user.uid,
      team_id: teamRef.id,
      agent_id: leadAgentId,
      role: "lead",
      created_at: now,
    });

    for (const agentId of memberAgentIds.filter((id) => id !== leadAgentId)) {
      const memberRef = adminDb.collection(COLLECTIONS.WORK_TEAM_MEMBERS).doc();
      batch.set(memberRef, {
        user_id: auth.user.uid,
        team_id: teamRef.id,
        agent_id: agentId,
        role: "member",
        created_at: now,
      });
    }

    await batch.commit();
    return NextResponse.json(
      { team: { id: teamRef.id, ...team } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create work team:", error);
    return NextResponse.json(
      { error: "Failed to create work team." },
      { status: 500 }
    );
  }
}
