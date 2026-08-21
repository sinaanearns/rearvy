import type { Firestore } from "firebase-admin/firestore";
import {
  BUILT_IN_ABILITY_IDS,
  BUILT_IN_ABILITY_TOOL_NAMES,
  CORE_WORK_TOOL_NAMES,
} from "./abilities";

export type WorkToolAccess = {
  builtInAbilityIds: string[];
  mcpServerIds: string[];
  includeWebTools: boolean;
  includeBrowserTools: boolean;
  includeTerminalTools: boolean;
  includeFLERBAITools: boolean;
  allowedToolNames: string[] | null;
  allowedMcpServerIds: string[] | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function getActiveMcpServerId(id: string, data: unknown) {
  const server = isRecord(data) ? data : {};
  return server.is_active === false ? null : id;
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
    isDesktopApp?: boolean;
  }
): Promise<WorkToolAccess> {
  void db;
  void params.userId;

  return {
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
