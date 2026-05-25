import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { BUILT_IN_SKILL_TEMPLATES } from "@/lib/work/platform";

export const runtime = "nodejs";

function readString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const [installedSnapshot, mcpSnapshot] = await Promise.all([
      adminDb
        .collection(COLLECTIONS.WORK_AGENT_SKILLS)
        .where("user_id", "==", auth.user.uid)
        .get(),
      adminDb
        .collection(COLLECTIONS.MCP_SERVERS)
        .where("user_id", "==", auth.user.uid)
        .get(),
    ]);

    const installed = installedSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    const mcpServers = mcpSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      catalog: BUILT_IN_SKILL_TEMPLATES,
      installed,
      mcpServers,
    });
  } catch (error) {
    console.error("Failed to list work skills:", error);
    return NextResponse.json(
      { error: "Failed to list work skills." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const skillId = readString(body?.skillId);
    const mcpServerId = readString(body?.mcpServerId);
    const agentId = readString(body?.agentId) || null;
    const scope = body?.scope === "agent" && agentId ? "agent" : "account";
    const now = new Date().toISOString();

    const template = BUILT_IN_SKILL_TEMPLATES.find((skill) => skill.id === skillId);
    let name = template?.name || readString(body?.name, "MCP Skill");
    let description = template?.description || readString(body?.description, "External MCP capability.");
    let source: "built_in" | "mcp" = template ? "built_in" : "mcp";

    if (!template && mcpServerId) {
      const server = await adminDb.collection(COLLECTIONS.MCP_SERVERS).doc(mcpServerId).get();
      const serverData = server.data();
      if (!server.exists || !serverData || serverData.user_id !== auth.user.uid) {
        return NextResponse.json({ error: "MCP server not found." }, { status: 404 });
      }
      name = readString(serverData.name, name);
      description = `MCP server skill: ${name}`;
      source = "mcp";
    } else if (!template) {
      return NextResponse.json({ error: "Unknown skill." }, { status: 400 });
    }

    const payload = {
      user_id: auth.user.uid,
      agent_id: agentId,
      skill_id: template?.id || `mcp:${mcpServerId}`,
      name,
      description,
      scope,
      source,
      mcp_server_id: mcpServerId || null,
      is_enabled: true,
      created_at: now,
      updated_at: now,
    };
    const ref = adminDb.collection(COLLECTIONS.WORK_AGENT_SKILLS).doc();
    await ref.set(payload);

    return NextResponse.json({ skill: { id: ref.id, ...payload } }, { status: 201 });
  } catch (error) {
    console.error("Failed to install work skill:", error);
    return NextResponse.json(
      { error: "Failed to install work skill." },
      { status: 500 }
    );
  }
}
