import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { createServerLogger } from "@/lib/server-logger";
import { listWorkAgents } from "@/lib/work/platform";

export const runtime = "nodejs";

const log = createServerLogger("WorkSummaryApi");

async function countUserDocs(collection: string, userId: string) {
  const snapshot = await adminDb.collection(collection).where("user_id", "==", userId).get();
  return snapshot.size;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const isDesktop =
      request.headers.get("x-rearvy-desktop") === "1" ||
      (request.headers.get("user-agent") || "").toLowerCase().includes("electron");
    const [
      agents,
      integrations,
      mcpServers,
      automations,
      teams,
      runs,
      channelConnections,
      sourceTasks,
      pairedDevices,
      tasks,
      listeners,
      processes,
      diaryEntries,
    ] = await Promise.all([
      listWorkAgents(adminDb, auth.user.uid),
      countUserDocs(COLLECTIONS.INTEGRATIONS, auth.user.uid),
      countUserDocs(COLLECTIONS.MCP_SERVERS, auth.user.uid),
      countUserDocs(COLLECTIONS.WORK_SCHEDULED_AUTOMATIONS, auth.user.uid),
      countUserDocs(COLLECTIONS.WORK_AGENT_TEAMS, auth.user.uid),
      countUserDocs(COLLECTIONS.WORK_AUTOMATION_RUNS, auth.user.uid),
      countUserDocs(COLLECTIONS.WORK_CHANNEL_CONNECTIONS, auth.user.uid),
      countUserDocs(COLLECTIONS.WORK_SOURCE_TASKS, auth.user.uid),
      countUserDocs(COLLECTIONS.WORK_PAIRED_DEVICES, auth.user.uid),
      countUserDocs(COLLECTIONS.WORK_TASKS, auth.user.uid),
      countUserDocs(COLLECTIONS.WORK_LISTENERS, auth.user.uid),
      countUserDocs(COLLECTIONS.WORK_PROCESS_SESSIONS, auth.user.uid),
      countUserDocs(COLLECTIONS.WORK_DIARY_ENTRIES, auth.user.uid),
    ]);

    return NextResponse.json({
      counts: {
        agents: agents.length,
        customAgents: agents.filter((agent) => agent.source === "custom").length,
        integrations,
        mcpServers,
        automations,
        teams,
        runs,
        channelConnections,
        sourceTasks,
        pairedDevices,
        tasks,
        listeners,
        processes,
        diaryEntries,
      },
      readiness: {
        desktopRuntime: isDesktop,
        browserAutomation: !process.env.VERCEL,
        connectors: integrations > 0,
        abilities: true,
        teams: teams > 0,
        channels: channelConnections > 0 ? "active" : "live shells",
        sources: sourceTasks > 0 ? "active" : "ready",
        listeners: listeners > 0 ? "active" : "ready",
        processes: processes > 0 ? "active" : "ready",
        pairing: isDesktop ? "local" : "web",
        pairedDevices,
      },
    });
  } catch (error) {
    log.error("Failed to build work summary:", error);
    return NextResponse.json(
      { error: "Failed to build work summary." },
      { status: 500 }
    );
  }
}
