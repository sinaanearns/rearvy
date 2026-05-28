import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS, type WorkAgent, type WorkAgentCapabilityPreset } from "@/lib/firebase/schema";
import { CHAT_AGENTS, getChatAgentById, type ChatAgentDefinition } from "@/lib/ai/chat-agents";
import { getNextCronRunAt, normalizeWorkSchedule } from "./schedule";
import { normalizeAutoExecute, normalizeTrustedScope } from "./trusted";

export type WorkAgentInput = {
  name?: unknown;
  shortLabel?: unknown;
  summary?: unknown;
  role?: unknown;
  instructions?: unknown;
  systemPrompt?: unknown;
  modelId?: unknown;
  capabilityPreset?: unknown;
  workspaceScope?: unknown;
  installedSkillIds?: unknown;
  memoryEnabled?: unknown;
  visibility?: unknown;
};

export type WorkAutomationInput = {
  name?: unknown;
  description?: unknown;
  task?: unknown;
  schedule?: unknown;
  timezone?: unknown;
  runTarget?: unknown;
  agentId?: unknown;
  teamId?: unknown;
  projectId?: unknown;
  approvalRequired?: unknown;
  isEnabled?: unknown;
  autoExecuteEnabled?: unknown;
  trustedScope?: unknown;
};

export type BuiltInSkillTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  defaultScope: "account" | "agent";
  capabilities: string[];
};

export const BUILT_IN_SKILL_TEMPLATES: BuiltInSkillTemplate[] = [
  {
    id: "web-research",
    name: "Web Research",
    description: "Search, fetch, compare, and summarize public web information.",
    category: "Research",
    defaultScope: "account",
    capabilities: ["searchWeb", "fetchWebPage"],
  },
  {
    id: "business-data",
    name: "Business Data",
    description: "Analyze revenue, orders, products, reviews, traffic, and synced social data.",
    category: "Analytics",
    defaultScope: "account",
    capabilities: ["revenue", "orders", "products", "reviews", "analytics"],
  },
  {
    id: "browser-operator",
    name: "Browser Operator",
    description: "Run local browser-use sessions with explicit approval for sensitive actions.",
    category: "Local execution",
    defaultScope: "agent",
    capabilities: ["runBrowserTask", "controlBrowserSession"],
  },
  {
    id: "terminal-files",
    name: "Terminal and Files",
    description: "Read files, inspect directories, and run local terminal commands when permitted.",
    category: "Local execution",
    defaultScope: "agent",
    capabilities: ["listDirectory", "readFile", "runTerminalCommand"],
  },
  {
    id: "commerce-ops",
    name: "Commerce Ops",
    description: "Use existing Shopify, Gmail, Instagram, Facebook, YouTube, Excel, and GitHub data for operations work.",
    category: "Operations",
    defaultScope: "account",
    capabilities: ["integrations", "sync", "gmailDrafts"],
  },
  {
    id: "agent-teamwork",
    name: "Agent Teamwork",
    description: "Delegate subtasks to specialists and aggregate results for complex work.",
    category: "Collaboration",
    defaultScope: "agent",
    capabilities: ["delegateToSpecialistAgent", "spawnAgentTeam"],
  },
];

const CAPABILITY_PRESETS = new Set<WorkAgentCapabilityPreset>([
  "standard",
  "full",
  "minimal",
  "team_lead",
]);

const RUN_TARGETS = new Set(["agent", "team", "browser", "python", "sync"]);

function nowIso() {
  return new Date().toISOString();
}

function readString(value: unknown, fallback: string, maxLength = 4000) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : fallback;
}

function readNullableString(value: unknown, maxLength = 4000) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : null;
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeCapabilityPreset(value: unknown): WorkAgentCapabilityPreset {
  return typeof value === "string" && CAPABILITY_PRESETS.has(value as WorkAgentCapabilityPreset)
    ? (value as WorkAgentCapabilityPreset)
    : "standard";
}

function normalizeSkillIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ).slice(0, 40);
}

function normalizeWorkspaceScope(value: unknown): WorkAgent["workspace_scope"] {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const mode =
    source.mode === "project" || source.mode === "folder" || source.mode === "none"
      ? source.mode
      : "none";

  return {
    mode,
    project_id: mode === "project" ? readNullableString(source.projectId ?? source.project_id, 200) : null,
    path: mode === "folder" ? readNullableString(source.path, 1000) : null,
  };
}

function timestampToString(value: unknown): string {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    try {
      return value.toDate().toISOString();
    } catch {
      return nowIso();
    }
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return typeof value === "string" && value ? value : nowIso();
}

function toAgentRecord(id: string, data: Record<string, unknown>): WorkAgent {
  return {
    id,
    user_id: String(data.user_id || ""),
    name: String(data.name || "Untitled Agent"),
    short_label: String(data.short_label || data.name || "Agent"),
    summary: String(data.summary || ""),
    role: String(data.role || ""),
    instructions: String(data.instructions || ""),
    system_prompt: String(data.system_prompt || data.instructions || ""),
    model_id: typeof data.model_id === "string" ? data.model_id : null,
    capability_preset: normalizeCapabilityPreset(data.capability_preset),
    workspace_scope: normalizeWorkspaceScope(data.workspace_scope),
    installed_skill_ids: normalizeSkillIds(data.installed_skill_ids),
    memory_enabled: data.memory_enabled !== false,
    visibility: data.visibility === "team" ? "team" : "private",
    source: data.source === "built_in" ? "built_in" : "custom",
    built_in_key: typeof data.built_in_key === "string" ? data.built_in_key : null,
    is_active: data.is_active !== false,
    created_at: timestampToString(data.created_at),
    updated_at: timestampToString(data.updated_at),
  };
}

function fromChatAgentTemplate(userId: string, agent: ChatAgentDefinition): Omit<WorkAgent, "id"> {
  const now = nowIso();
  return {
    user_id: userId,
    name: agent.name,
    short_label: agent.shortLabel,
    summary: agent.summary,
    role: agent.placeholder,
    instructions: agent.systemPrompt,
    system_prompt: agent.systemPrompt,
    model_id: "auto",
    capability_preset: agent.id === "competitor-research" ? "full" : "standard",
    workspace_scope: {
      mode: "none",
      project_id: null,
      path: null,
    },
    installed_skill_ids:
      agent.id === "competitor-research"
        ? ["web-research", "browser-operator", "business-data"]
        : ["business-data", "web-research"],
    memory_enabled: true,
    visibility: "private",
    source: "built_in",
    built_in_key: agent.id,
    is_active: true,
    created_at: now,
    updated_at: now,
  };
}

export function normalizeWorkAgentInput(input: WorkAgentInput, existing?: WorkAgent): Omit<WorkAgent, "id"> {
  const fallbackName = existing?.name || "Custom Agent";
  const name = readString(input.name, fallbackName, 120);
  const summary = readString(input.summary, existing?.summary || "Custom Rearvy work agent.", 500);
  const role = readString(input.role, existing?.role || summary, 800);
  const instructions = readString(
    input.instructions,
    existing?.instructions || "Help the user complete practical business work using available Rearvy context and tools.",
    8000
  );
  const systemPrompt = readString(input.systemPrompt, existing?.system_prompt || instructions, 12000);
  const now = nowIso();

  return {
    user_id: existing?.user_id || "",
    name,
    short_label: readString(input.shortLabel, existing?.short_label || name, 48),
    summary,
    role,
    instructions,
    system_prompt: systemPrompt,
    model_id: readNullableString(input.modelId, 200) ?? existing?.model_id ?? "auto",
    capability_preset: normalizeCapabilityPreset(input.capabilityPreset ?? existing?.capability_preset),
    workspace_scope: normalizeWorkspaceScope(input.workspaceScope ?? existing?.workspace_scope),
    installed_skill_ids:
      input.installedSkillIds === undefined
        ? existing?.installed_skill_ids || []
        : normalizeSkillIds(input.installedSkillIds),
    memory_enabled: readBoolean(input.memoryEnabled, existing?.memory_enabled ?? true),
    visibility: input.visibility === "team" || existing?.visibility === "team" ? "team" : "private",
    source: existing?.source || "custom",
    built_in_key: existing?.built_in_key || null,
    is_active: existing?.is_active ?? true,
    created_at: existing?.created_at || now,
    updated_at: now,
  };
}

export function toChatAgentDefinition(agent: WorkAgent): ChatAgentDefinition {
  const toolNotes = [
    `Capability preset: ${agent.capability_preset}.`,
    agent.installed_skill_ids.length
      ? `Installed skills: ${agent.installed_skill_ids.join(", ")}.`
      : "No extra skills installed.",
    agent.memory_enabled
      ? "Use long-term memory when relevant."
      : "Do not rely on long-term memory unless explicitly provided in context.",
  ].join("\n");

  return {
    id: agent.id,
    name: agent.name,
    shortLabel: agent.short_label,
    summary: agent.summary,
    placeholder: agent.role || agent.summary,
    starterPrompts: [
      {
        label: `Ask ${agent.short_label}`,
        prompt: `Work as ${agent.name} and help me with the highest-priority next step.`,
      },
    ],
    systemPrompt: `${agent.system_prompt || agent.instructions}\n\n${toolNotes}`,
  };
}

export async function ensureDefaultWorkAgents(db: Firestore, userId: string) {
  const snapshot = await db
    .collection(COLLECTIONS.WORK_AGENTS)
    .where("user_id", "==", userId)
    .get();
  const existingBuiltIns = new Set(
    snapshot.docs
      .map((doc) => doc.data().built_in_key)
      .filter((value): value is string => typeof value === "string")
  );

  const batch = db.batch();
  let writes = 0;

  for (const template of CHAT_AGENTS) {
    if (existingBuiltIns.has(template.id)) {
      continue;
    }

    const ref = db.collection(COLLECTIONS.WORK_AGENTS).doc();
    batch.set(ref, fromChatAgentTemplate(userId, template));
    writes += 1;
  }

  if (writes > 0) {
    await batch.commit();
  }
}

export async function listWorkAgents(db: Firestore, userId: string): Promise<WorkAgent[]> {
  await ensureDefaultWorkAgents(db, userId);

  const snapshot = await db
    .collection(COLLECTIONS.WORK_AGENTS)
    .where("user_id", "==", userId)
    .get();

  return snapshot.docs
    .map((doc) => toAgentRecord(doc.id, doc.data()))
    .filter((agent) => agent.is_active)
    .sort((left, right) => {
      if (left.source !== right.source) {
        return left.source === "built_in" ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    });
}

export async function getWorkAgent(db: Firestore, userId: string, agentId: string) {
  const doc = await db.collection(COLLECTIONS.WORK_AGENTS).doc(agentId).get();
  if (!doc.exists) {
    return null;
  }

  const agent = toAgentRecord(doc.id, doc.data() || {});
  return agent.user_id === userId && agent.is_active ? agent : null;
}

export async function createWorkAgent(db: Firestore, userId: string, input: WorkAgentInput) {
  const payload = normalizeWorkAgentInput(input);
  const now = nowIso();
  const ref = db.collection(COLLECTIONS.WORK_AGENTS).doc();
  const agent: Omit<WorkAgent, "id"> = {
    ...payload,
    user_id: userId,
    source: "custom",
    built_in_key: null,
    created_at: now,
    updated_at: now,
  };

  await ref.set(agent);
  return { id: ref.id, ...agent };
}

export async function updateWorkAgent(
  db: Firestore,
  userId: string,
  agentId: string,
  input: WorkAgentInput
) {
  const existing = await getWorkAgent(db, userId, agentId);
  if (!existing) {
    return null;
  }

  const next = normalizeWorkAgentInput(input, existing);
  const payload = {
    ...next,
    user_id: userId,
    source: existing.source,
    built_in_key: existing.built_in_key,
  };

  await db.collection(COLLECTIONS.WORK_AGENTS).doc(agentId).set(payload, { merge: true });
  return { id: agentId, ...payload };
}

export async function resolveChatAgentForUser(
  db: Firestore,
  userId: string,
  agentId?: string | null
) {
  if (!agentId) {
    return null;
  }

  const builtIn = getChatAgentById(agentId);
  if (builtIn) {
    return builtIn;
  }

  const persisted = await getWorkAgent(db, userId, agentId);
  return persisted ? toChatAgentDefinition(persisted) : null;
}

export function normalizeSchedule(value: unknown) {
  return normalizeWorkSchedule(value);
}

export function estimateNextRunAt(schedule: string, now = new Date(), timezone = "UTC") {
  try {
    return getNextCronRunAt(schedule, timezone, now);
  } catch {
    const next = new Date(now.getTime());
    next.setMinutes(0, 0, 0);
    next.setHours(next.getHours() + 1);
    return next.toISOString();
  }
}

export function normalizeAutomationInput(input: WorkAutomationInput, existing?: Record<string, unknown>) {
  const scheduleInfo = normalizeSchedule(input.schedule ?? existing?.schedule);
  const now = nowIso();
  const timezone = readString(input.timezone, String(existing?.timezone || "UTC"), 80);
  const runTarget =
    typeof input.runTarget === "string" && RUN_TARGETS.has(input.runTarget)
      ? input.runTarget
      : typeof existing?.run_target === "string" && RUN_TARGETS.has(existing.run_target)
        ? existing.run_target
        : "agent";

  return {
    agent_id: readNullableString(input.agentId ?? existing?.agent_id, 200),
    team_id: readNullableString(input.teamId ?? existing?.team_id, 200),
    project_id: readNullableString(input.projectId ?? existing?.project_id, 200),
    name: readString(input.name, String(existing?.name || "Scheduled work"), 140),
    description: readNullableString(input.description ?? existing?.description, 1000),
    task: readString(input.task, String(existing?.task || "Create a concise work update."), 8000),
    schedule: scheduleInfo.schedule,
    schedule_label: scheduleInfo.label,
    timezone,
    run_target: runTarget,
    approval_required: readBoolean(input.approvalRequired, Boolean(existing?.approval_required ?? true)),
    auto_execute_enabled: normalizeAutoExecute(
      input.autoExecuteEnabled,
      Boolean(existing?.auto_execute_enabled ?? false)
    ),
    trusted_scope: normalizeTrustedScope(input.trustedScope ?? existing?.trusted_scope),
    last_auto_executed_at:
      typeof existing?.last_auto_executed_at === "string"
        ? existing.last_auto_executed_at
        : null,
    is_enabled: readBoolean(input.isEnabled, Boolean(existing?.is_enabled ?? true)),
    next_run_at: estimateNextRunAt(scheduleInfo.schedule, new Date(), timezone),
    updated_at: now,
  };
}
