import type { Firestore } from "firebase-admin/firestore";
import {
  COLLECTIONS,
  type McpServerConfig,
  type WorkAgent,
} from "@/lib/firebase/schema";
import {
  BUILT_IN_ABILITY_IDS,
  BUILT_IN_ABILITY_TOOL_NAMES,
  CORE_WORK_TOOL_NAMES,
} from "./abilities";
import { getWorkAgent } from "./platform";

export type WorkToolAccess = {
  agent: WorkAgent | null;
  builtInAbilityIds: string[];
  mcpServerIds: string[];
  includeWebTools: boolean;
  includeBrowserTools: boolean;
  includeTerminalTools: boolean;
  includeFLERBAITools: boolean;
  allowedToolNames: string[] | null;
  allowedMcpServerIds: string[] | null;
};

function normalizeSkillId(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function resolveToolNamesForSkills(skillIds: Iterable<string>) {
  const allowed = new Set(CORE_WORK_TOOL_NAMES);

  for (const skillId of skillIds) {
    for (const toolName of BUILT_IN_ABILITY_TOOL_NAMES[skillId] || []) {
      allowed.add(toolName);
    }
  }

  return allowed;
}

export function resolveToolNamesForAbilities(abilityIds: Iterable<string>) {
  return resolveToolNamesForSkills(abilityIds);
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
      builtInAbilityIds: BUILT_IN_ABILITY_IDS,
      mcpServerIds: [],
      includeWebTools: true,
      includeBrowserTools: true,
      includeTerminalTools: true,
      includeFLERBAITools: Boolean(params.isDesktopApp),
      allowedToolNames: null,
      allowedMcpServerIds: null,
    };
  }

  const mcpSnapshot = await db
    .collection(COLLECTIONS.MCP_SERVERS)
    .where("user_id", "==", params.userId)
    .get();

  const activeMcpServerIds = new Set(
    mcpSnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }) as McpServerConfig)
      .filter((server) => server.is_active !== false)
      .map((server) => server.id)
  );
  const builtInAbilityIds = BUILT_IN_ABILITY_IDS.map(normalizeSkillId).filter(Boolean) as string[];

  return {
    agent,
    builtInAbilityIds,
    mcpServerIds: Array.from(activeMcpServerIds).sort(),
    includeWebTools: true,
    includeBrowserTools: true,
    includeTerminalTools: true,
    includeFLERBAITools: Boolean(params.isDesktopApp),
    allowedToolNames: null,
    allowedMcpServerIds: null,
  };
}
