import type { DocumentData, Firestore, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { COLLECTIONS, type WorkAgent, type WorkAgentCapabilityPreset } from "@/lib/firebase/schema";
import { CHAT_AGENTS, getChatAgentById, type ChatAgentDefinition } from "@/lib/ai/chat-agents";
import { getNextCronRunAt, normalizeWorkSchedule } from "./schedule";
import { normalizeAutoExecute, normalizeTrustedScope } from "./trusted";

export const AUTOMATON_AGENT_KEY = "automaton";
export const AUTOMATON_AUTOMATION_KEY = "automaton-business-pulse";
export const AUTOMATON_DEFAULT_SKILL_IDS = [
  "business-data",
  "commerce-ops",
  "web-research",
  "browser-operator",
  "terminal-files",
  "agent-teamwork",
];

const LEGACY_AUTOMATON_SUMMARY =
  "Rearvy-powered self-running business agent for daily monitoring, prioritization, and follow-up.";
const LEGACY_AUTOMATON_AUTOMATION_NAME = "Automaton Business Pulse";

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
const BUILT_IN_AGENT_IDS = new Set(CHAT_AGENTS.map((agent) => agent.id));
const BUILT_IN_AGENT_KEY_BY_LABEL = new Map(
  CHAT_AGENTS.flatMap((agent) => [
    [normalizeLookupText(agent.name), agent.id],
    [normalizeLookupText(agent.shortLabel), agent.id],
  ])
);

function nowIso() {
  return new Date().toISOString();
}

function normalizeLookupText(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
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

function timestampToMillis(value: unknown): number {
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    try {
      return value.toMillis();
    } catch {
      return 0;
    }
  }

  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    try {
      return value.toDate().getTime();
    } catch {
      return 0;
    }
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "string" && value) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

function getBuiltInWorkAgentDocId(userId: string, builtInKey: string) {
  return `built_in_${encodeURIComponent(userId)}_${builtInKey}`;
}

function getBuiltInWorkAutomationDocId(userId: string, builtInKey: string) {
  return `built_in_automation_${encodeURIComponent(userId)}_${builtInKey}`;
}

function resolveBuiltInAgentKey(id: string, data: Record<string, unknown>): string | null {
  const explicitKey = readNullableString(data.built_in_key, 200);
  if (explicitKey) {
    return explicitKey;
  }

  if (data.source !== "built_in") {
    return null;
  }

  if (BUILT_IN_AGENT_IDS.has(id)) {
    return id;
  }

  return (
    BUILT_IN_AGENT_KEY_BY_LABEL.get(normalizeLookupText(data.name)) ??
    BUILT_IN_AGENT_KEY_BY_LABEL.get(normalizeLookupText(data.short_label)) ??
    null
  );
}

function toAgentRecord(id: string, data: Record<string, unknown>): WorkAgent {
  const source = data.source === "built_in" ? "built_in" : "custom";
  const builtInKey = source === "built_in" ? resolveBuiltInAgentKey(id, data) : null;
  const performanceScore =
    typeof data.performance_score === "number" && Number.isFinite(data.performance_score)
      ? Math.min(Math.max(Math.round(data.performance_score), 1), 5)
      : null;
  const lowScoreStreak =
    typeof data.low_score_streak === "number" && Number.isFinite(data.low_score_streak)
      ? Math.max(0, Math.floor(data.low_score_streak))
      : 0;
  const qualityStatus =
    data.quality_status === "healthy" ||
    data.quality_status === "watch" ||
    data.quality_status === "low_score" ||
    data.quality_status === "archived"
      ? data.quality_status
      : "unknown";

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
    source,
    built_in_key: builtInKey,
    performance_score: performanceScore,
    quality_status: qualityStatus,
    last_evaluated_at: readNullableString(data.last_evaluated_at, 80),
    low_score_streak: lowScoreStreak,
    archive_reason: readNullableString(data.archive_reason, 1000),
    is_active: data.is_active !== false,
    created_at: timestampToString(data.created_at),
    updated_at: timestampToString(data.updated_at),
  };
}

function fromChatAgentTemplate(userId: string, agent: ChatAgentDefinition): Omit<WorkAgent, "id"> {
  const now = nowIso();
  const isAutomaton = agent.id === AUTOMATON_AGENT_KEY;
  return {
    user_id: userId,
    name: agent.name,
    short_label: agent.shortLabel,
    summary: agent.summary,
    role: agent.placeholder,
    instructions: agent.systemPrompt,
    system_prompt: agent.systemPrompt,
    model_id: "auto",
    capability_preset: agent.id === "competitor-research" || isAutomaton ? "full" : "standard",
    workspace_scope: {
      mode: "none",
      project_id: null,
      path: null,
    },
    installed_skill_ids:
      isAutomaton
        ? AUTOMATON_DEFAULT_SKILL_IDS
        : agent.id === "competitor-research"
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

export function shouldRefreshAutomatonBuiltInAgent(data: Record<string, unknown>) {
  const builtInKey = resolveBuiltInAgentKey("", data);
  if (data.source !== "built_in" || builtInKey !== AUTOMATON_AGENT_KEY) {
    return false;
  }

  const summary = readString(data.summary, "", 1000);
  const instructions = readString(data.instructions, "", 12000);
  const systemPrompt = readString(data.system_prompt, "", 12000);

  return (
    summary === LEGACY_AUTOMATON_SUMMARY ||
    instructions.includes("Default to a daily operating rhythm") ||
    systemPrompt.includes("Default to a daily operating rhythm")
  );
}

function getAutomatonTemplatePatch(userId: string) {
  const template = CHAT_AGENTS.find((agent) => agent.id === AUTOMATON_AGENT_KEY);
  if (!template) {
    return null;
  }

  const defaults = fromChatAgentTemplate(userId, template);
  return {
    name: defaults.name,
    short_label: defaults.short_label,
    summary: defaults.summary,
    role: defaults.role,
    instructions: defaults.instructions,
    system_prompt: defaults.system_prompt,
    capability_preset: defaults.capability_preset,
    installed_skill_ids: defaults.installed_skill_ids,
    memory_enabled: true,
    built_in_key: AUTOMATON_AGENT_KEY,
    updated_at: nowIso(),
  };
}

export function buildDefaultAutomatonAutomationInput(agentId: string) {
  return {
    name: "Automaton 24/7 Operator",
    description:
      "Gated self-running Rearvy operator for monitoring, client acquisition, memory, agent quality, and follow-up.",
    task:
      "Run the Automaton 24/7 operator cycle. Review connected data, tasks, automations, recent runs, source research, channel activity, memories, desktop/browser readiness, and agent quality. Queue safe follow-up work, flag blockers, ask for assistance when needed, and produce a concise operating update.",
    schedule: "hourly",
    runTarget: "agent",
    agentId,
    approvalRequired: false,
    autoExecuteEnabled: true,
    trustedScope: "trusted",
    isEnabled: true,
  };
}

export function shouldRefreshAutomatonAutomationDefaults(data: Record<string, unknown>) {
  return (
    (data.built_in_key === AUTOMATON_AUTOMATION_KEY ||
      data.name === LEGACY_AUTOMATON_AUTOMATION_NAME) &&
    (data.name === LEGACY_AUTOMATON_AUTOMATION_NAME ||
      data.description === "Rearvy-powered self-running business pulse for signals, risks, and next actions." ||
      data.task ===
        "Run the Automaton business pulse. Review connected data, tasks, automations, recent runs, source research, and channel activity. Produce a concise operating update with top signals, risks, actions queued, and what to watch next.")
  );
}

async function ensureDefaultAutomatonAutomation(
  db: Firestore,
  userId: string,
  agentId: string
) {
  const snapshot = await db
    .collection(COLLECTIONS.WORK_SCHEDULED_AUTOMATIONS)
    .where("user_id", "==", userId)
    .get();
  const existing = snapshot.docs.find(
    (doc) =>
      doc.data().built_in_key === AUTOMATON_AUTOMATION_KEY ||
      doc.data().name === LEGACY_AUTOMATON_AUTOMATION_NAME
  );

  if (existing) {
    const data = existing.data();
    const shouldRefreshDefaults = shouldRefreshAutomatonAutomationDefaults(data);
    const patch = {
      ...(data.built_in_key !== AUTOMATON_AUTOMATION_KEY ? { built_in_key: AUTOMATON_AUTOMATION_KEY } : {}),
      ...(data.source !== "built_in" ? { source: "built_in" } : {}),
      ...(data.agent_id !== agentId && data.is_enabled !== false ? { agent_id: agentId } : {}),
      ...(shouldRefreshDefaults
        ? normalizeAutomationInput(buildDefaultAutomatonAutomationInput(agentId), data)
        : {}),
    };

    if (Object.keys(patch).length > 0) {
      await existing.ref.set(
        {
          ...patch,
          updated_at: nowIso(),
        },
        { merge: true }
      );
    }
    return;
  }

  const now = nowIso();
  const automation = normalizeAutomationInput(buildDefaultAutomatonAutomationInput(agentId));

  await db
    .collection(COLLECTIONS.WORK_SCHEDULED_AUTOMATIONS)
    .doc(getBuiltInWorkAutomationDocId(userId, AUTOMATON_AUTOMATION_KEY))
    .set({
      user_id: userId,
      ...automation,
      built_in_key: AUTOMATON_AUTOMATION_KEY,
      source: "built_in",
      last_run_at: null,
      created_at: now,
      updated_at: now,
    });
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

function isPreferredWorkAgent(candidate: WorkAgent, current: WorkAgent) {
  const candidateUpdatedAt = timestampToMillis(candidate.updated_at);
  const currentUpdatedAt = timestampToMillis(current.updated_at);
  if (candidateUpdatedAt !== currentUpdatedAt) {
    return candidateUpdatedAt > currentUpdatedAt;
  }

  return candidate.id.localeCompare(current.id) < 0;
}

function getWorkAgentDedupeKey(agent: WorkAgent) {
  if (agent.source !== "built_in") {
    return null;
  }

  const builtInKey =
    agent.built_in_key ??
    BUILT_IN_AGENT_KEY_BY_LABEL.get(normalizeLookupText(agent.name)) ??
    BUILT_IN_AGENT_KEY_BY_LABEL.get(normalizeLookupText(agent.short_label));

  return builtInKey
    ? `built_in:${builtInKey}`
    : `built_in_name:${normalizeLookupText(agent.name)}`;
}

function sortWorkAgents(agents: WorkAgent[]) {
  return agents.sort((left, right) => {
    if (left.source !== right.source) {
      return left.source === "built_in" ? -1 : 1;
    }
    return left.name.localeCompare(right.name);
  });
}

export function dedupeActiveWorkAgents(agents: WorkAgent[]) {
  const builtInsByKey = new Map<string, WorkAgent>();
  const otherAgents: WorkAgent[] = [];

  for (const agent of agents) {
    if (!agent.is_active) {
      continue;
    }

    const dedupeKey = getWorkAgentDedupeKey(agent);
    if (!dedupeKey) {
      otherAgents.push(agent);
      continue;
    }

    const existing = builtInsByKey.get(dedupeKey);
    if (!existing || isPreferredWorkAgent(agent, existing)) {
      builtInsByKey.set(dedupeKey, agent);
    }
  }

  return sortWorkAgents([...builtInsByKey.values(), ...otherAgents]);
}

function isPreferredBuiltInDoc(
  candidate: QueryDocumentSnapshot<DocumentData>,
  current: QueryDocumentSnapshot<DocumentData>
) {
  const candidateUpdatedAt = timestampToMillis(candidate.data().updated_at);
  const currentUpdatedAt = timestampToMillis(current.data().updated_at);
  if (candidateUpdatedAt !== currentUpdatedAt) {
    return candidateUpdatedAt > currentUpdatedAt;
  }

  return candidate.id.localeCompare(current.id) < 0;
}

export async function ensureDefaultWorkAgents(db: Firestore, userId: string) {
  const snapshot = await db
    .collection(COLLECTIONS.WORK_AGENTS)
    .where("user_id", "==", userId)
    .get();
  const builtInDocsByKey = new Map<string, QueryDocumentSnapshot<DocumentData>[]>();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const builtInKey = resolveBuiltInAgentKey(doc.id, data);
    if (data.source !== "built_in" || !builtInKey) {
      continue;
    }

    const docs = builtInDocsByKey.get(builtInKey) || [];
    docs.push(doc);
    builtInDocsByKey.set(builtInKey, docs);
  }

  const batch = db.batch();
  let writes = 0;
  const updatedAt = nowIso();
  let automatonAgentId: string | null = null;

  for (const [builtInKey, docs] of builtInDocsByKey) {
    const activeDocs = docs.filter((doc) => doc.data().is_active !== false);
    const keepDoc = activeDocs.reduce<QueryDocumentSnapshot<DocumentData> | null>(
      (current, doc) => (!current || isPreferredBuiltInDoc(doc, current) ? doc : current),
      null
    );

    if (builtInKey === AUTOMATON_AGENT_KEY && keepDoc) {
      automatonAgentId = keepDoc.id;
    }

    for (const doc of docs) {
      const data = doc.data();
      const shouldBackfillKey = data.built_in_key !== builtInKey;
      const shouldArchiveDuplicate = Boolean(keepDoc && doc.id !== keepDoc.id && data.is_active !== false);
      const shouldRefreshAutomaton =
        doc.id === keepDoc?.id && shouldRefreshAutomatonBuiltInAgent({ ...data, built_in_key: builtInKey });
      const automatonPatch = shouldRefreshAutomaton ? getAutomatonTemplatePatch(userId) : null;

      if (!shouldBackfillKey && !shouldArchiveDuplicate && !automatonPatch) {
        continue;
      }

      batch.set(
        doc.ref,
        {
          ...(shouldBackfillKey ? { built_in_key: builtInKey } : {}),
          ...(shouldArchiveDuplicate ? { is_active: false } : {}),
          ...(automatonPatch ?? {}),
          updated_at: updatedAt,
        },
        { merge: true }
      );
      writes += 1;
    }
  }

  for (const template of CHAT_AGENTS) {
    if (builtInDocsByKey.has(template.id)) {
      continue;
    }

    const ref = db.collection(COLLECTIONS.WORK_AGENTS).doc(getBuiltInWorkAgentDocId(userId, template.id));
    batch.set(ref, fromChatAgentTemplate(userId, template));
    if (template.id === AUTOMATON_AGENT_KEY) {
      automatonAgentId = ref.id;
    }
    writes += 1;
  }

  if (writes > 0) {
    await batch.commit();
  }

  if (automatonAgentId) {
    await ensureDefaultAutomatonAutomation(db, userId, automatonAgentId);
  }
}

export async function listWorkAgents(db: Firestore, userId: string): Promise<WorkAgent[]> {
  await ensureDefaultWorkAgents(db, userId);

  const snapshot = await db
    .collection(COLLECTIONS.WORK_AGENTS)
    .where("user_id", "==", userId)
    .get();

  return dedupeActiveWorkAgents(snapshot.docs.map((doc) => toAgentRecord(doc.id, doc.data())));
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
