import { BUILT_IN_ABILITY_IDS, BUILT_IN_ABILITY_TEMPLATES, type BuiltInAbilityTemplate } from "./abilities";
import { getNextCronRunAt, normalizeWorkSchedule } from "./schedule";
import { normalizeAutoExecute, normalizeTrustedScope } from "./trusted";

export const AUTOMATON_AUTOMATION_KEY = "automaton-business-pulse";
export const AUTOMATON_DEFAULT_ABILITY_IDS = BUILT_IN_ABILITY_IDS;
export const AUTOMATON_DEFAULT_SKILL_IDS = AUTOMATON_DEFAULT_ABILITY_IDS;

const LEGACY_AUTOMATON_AUTOMATION_NAME = "Automaton Business Pulse";
const RUN_TARGETS = new Set(["browser", "python", "sync"]);

export type WorkAutomationInput = {
  name?: unknown;
  description?: unknown;
  task?: unknown;
  schedule?: unknown;
  timezone?: unknown;
  runTarget?: unknown;
  projectId?: unknown;
  approvalRequired?: unknown;
  isEnabled?: unknown;
  autoExecuteEnabled?: unknown;
  trustedScope?: unknown;
};

export type BuiltInSkillTemplate = BuiltInAbilityTemplate;
export const BUILT_IN_SKILL_TEMPLATES = BUILT_IN_ABILITY_TEMPLATES;

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

export function buildDefaultAutomatonAutomationInput(): WorkAutomationInput {
  return {
    name: "Automaton 24/7 Operator",
    description:
      "Gated self-running Rearvy operator for monitoring, client acquisition, memory, and follow-up.",
    task:
      "Run the Automaton 24/7 operator cycle. Review connected data, tasks, automations, recent runs, source research, channel activity, memories, and desktop/browser readiness. Queue safe follow-up work, flag blockers, ask for assistance when needed, and produce a concise operating update.",
    schedule: "hourly",
    runTarget: "sync",
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
        : "sync";

  return {
    agent_id: null,
    team_id: null,
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
