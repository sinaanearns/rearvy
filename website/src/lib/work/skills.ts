import type { Firestore } from "firebase-admin/firestore";
import {
  COLLECTIONS,
  type McpServerConfig,
  type WorkAgent,
  type WorkAgentSkill,
} from "@/lib/firebase/schema";
import { BUILT_IN_SKILL_TEMPLATES, getWorkAgent } from "./platform";

export type WorkToolAccess = {
  agent: WorkAgent | null;
  installedSkillIds: string[];
  mcpServerIds: string[];
  includeWebTools: boolean;
  includeBrowserTools: boolean;
  includeTerminalTools: boolean;
  includeFLERBAITools: boolean;
  allowedToolNames: string[] | null;
  allowedMcpServerIds: string[] | null;
};

const CORE_TOOL_NAMES = new Set(["getCurrentDate"]);
const DESKTOP_WORKFLOW_TOOL_NAMES = [
  "executeWorkflow",
  "planWorkflow",
  "listWorkflowTemplates",
  "getWorkflowStatus",
];

const BUILT_IN_SKILL_TOOL_NAMES: Record<string, string[]> = {
  "web-research": [
    "searchWeb",
    "fetchWebPage",
    "generateMap",
  ],
  "business-data": [
    "getCollectionsOverview",
    "getCollectionsBreakdown",
    "getRevenue",
    "getRevenueBreakdown",
    "getOrders",
    "getOrderDetails",
    "getTopProducts",
    "getProductDetails",
    "getInventoryStatus",
    "comparePerformance",
    "getCustomerMetrics",
    "getRecentInsights",
    "getYouTubeChannelStats",
    "getTopYouTubeVideos",
    "getYouTubeVideoPerformance",
    "getYouTubeComments",
    "getInstagramAccountStats",
    "getTopInstagramPosts",
    "getInstagramPostPerformance",
    "getInstagramComments",
    "getProductReviews",
    "getReviewSummary",
    "getGoogleAnalyticsOverview",
    "getGoogleAnalyticsTopPages",
    "getGoogleAnalyticsTrafficSources",
    "getWebsiteOverview",
    "getTopPages",
    "getTrafficSources",
  ],
  "browser-operator": [
    "runBrowserTask",
    "controlBrowserSession",
    "stopBrowserSession",
    ...DESKTOP_WORKFLOW_TOOL_NAMES,
  ],
  "terminal-files": [
    "runTerminalCommand",
    "listDirectory",
    "readFile",
    ...DESKTOP_WORKFLOW_TOOL_NAMES,
  ],
  "commerce-ops": [
    "getIntegrationStatus",
    "getGmailInboxSummary",
    "getRecentGmailMessages",
    "searchGmailMessages",
    "getGmailSettings",
    "prepareGmailMessage",
    "runWhispernetAnalysis",
    "getTradingOpinion",
    "getBestTradeOpportunity",
    "getVerifiedTraderSignals",
  ],
  "agent-teamwork": [
    "delegateToSpecialistAgent",
    "spawnAgentTeam",
  ],
};

function normalizeSkillId(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeSkillRecord(id: string, data: Record<string, unknown>): WorkAgentSkill {
  return {
    id,
    user_id: String(data.user_id || ""),
    agent_id: typeof data.agent_id === "string" && data.agent_id ? data.agent_id : null,
    skill_id: String(data.skill_id || ""),
    name: String(data.name || "Skill"),
    description: String(data.description || ""),
    scope: data.scope === "agent" ? "agent" : "account",
    source: data.source === "mcp" ? "mcp" : "built_in",
    mcp_server_id: typeof data.mcp_server_id === "string" && data.mcp_server_id ? data.mcp_server_id : null,
    is_enabled: data.is_enabled !== false,
    created_at: String(data.created_at || ""),
    updated_at: String(data.updated_at || ""),
  };
}

function getDefaultSkillsForPreset(agent: WorkAgent | null) {
  if (!agent) {
    return [];
  }

  if (agent.installed_skill_ids.length > 0) {
    return agent.installed_skill_ids;
  }

  if (agent.capability_preset === "minimal") {
    return ["business-data"];
  }

  if (agent.capability_preset === "team_lead") {
    return ["business-data", "web-research", "agent-teamwork"];
  }

  if (agent.capability_preset === "full") {
    return BUILT_IN_SKILL_TEMPLATES.map((skill) => skill.id);
  }

  return ["business-data", "web-research"];
}

export function resolveToolNamesForSkills(skillIds: Iterable<string>) {
  const allowed = new Set(CORE_TOOL_NAMES);

  for (const skillId of skillIds) {
    for (const toolName of BUILT_IN_SKILL_TOOL_NAMES[skillId] || []) {
      allowed.add(toolName);
    }
  }

  return allowed;
}

export async function resolveWorkToolAccess(
  db: Firestore,
  params: {
    userId: string;
    agentId?: string | null;
    isDesktopApp?: boolean;
  }
): Promise<WorkToolAccess> {
  const agent = params.agentId ? await getWorkAgent(db, params.userId, params.agentId) : null;

  if (!params.agentId || !agent) {
    return {
      agent: null,
      installedSkillIds: [],
      mcpServerIds: [],
      includeWebTools: true,
      includeBrowserTools: true,
      includeTerminalTools: true,
      includeFLERBAITools: Boolean(params.isDesktopApp),
      allowedToolNames: null,
      allowedMcpServerIds: null,
    };
  }

  const [skillSnapshot, mcpSnapshot] = await Promise.all([
    db.collection(COLLECTIONS.WORK_AGENT_SKILLS).where("user_id", "==", params.userId).get(),
    db.collection(COLLECTIONS.MCP_SERVERS).where("user_id", "==", params.userId).get(),
  ]);

  const activeMcpServerIds = new Set(
    mcpSnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }) as McpServerConfig)
      .filter((server) => server.is_active !== false)
      .map((server) => server.id)
  );
  const skills = skillSnapshot.docs
    .map((doc) => normalizeSkillRecord(doc.id, doc.data()))
    .filter((skill) => skill.is_enabled)
    .filter((skill) => skill.scope === "account" || skill.agent_id === agent.id);

  const skillIds = new Set(getDefaultSkillsForPreset(agent).map(normalizeSkillId).filter(Boolean) as string[]);
  const mcpServerIds = new Set<string>();

  for (const skill of skills) {
    if (skill.source === "mcp") {
      if (skill.mcp_server_id && activeMcpServerIds.has(skill.mcp_server_id)) {
        mcpServerIds.add(skill.mcp_server_id);
      }
      continue;
    }
    const skillId = normalizeSkillId(skill.skill_id);
    if (skillId) {
      skillIds.add(skillId);
    }
  }

  const allowedToolNames = resolveToolNamesForSkills(skillIds);

  return {
    agent,
    installedSkillIds: Array.from(skillIds).sort(),
    mcpServerIds: Array.from(mcpServerIds).sort(),
    includeWebTools: skillIds.has("web-research"),
    includeBrowserTools: skillIds.has("browser-operator"),
    includeTerminalTools: skillIds.has("terminal-files"),
    includeFLERBAITools: Boolean(
      params.isDesktopApp &&
        (skillIds.has("browser-operator") || skillIds.has("terminal-files"))
    ),
    allowedToolNames: Array.from(allowedToolNames),
    allowedMcpServerIds: mcpServerIds.size > 0 ? Array.from(mcpServerIds) : [],
  };
}
