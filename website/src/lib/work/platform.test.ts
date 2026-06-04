import test from "node:test";
import assert from "node:assert/strict";

import {
  AUTOMATON_DEFAULT_ABILITY_IDS,
  AUTOMATON_DEFAULT_SKILL_IDS,
  buildDefaultAutomatonAutomationInput,
  dedupeActiveWorkAgents,
  normalizeAutomationInput,
  normalizeSchedule,
  normalizeWorkAgentInput,
  shouldRefreshAutomatonAutomationDefaults,
  shouldRefreshAutomatonBuiltInAgent,
  toChatAgentDefinition,
} from "./platform";
import type { WorkAgent } from "@/lib/firebase/schema";

test("normalizeSchedule accepts named presets and falls back for invalid cron", () => {
  assert.deepEqual(normalizeSchedule("daily"), {
    schedule: "0 9 * * *",
    label: "Daily at 09:00",
  });
  assert.deepEqual(normalizeSchedule("bad schedule"), {
    schedule: "0 9 * * 1-5",
    label: "Weekdays at 09:00",
  });
  assert.deepEqual(normalizeSchedule("15 8 * * 1"), {
    schedule: "15 8 * * 1",
    label: "15 8 * * 1",
  });
});

test("normalizeWorkAgentInput clamps agent fields and defaults safety settings", () => {
  const agent = normalizeWorkAgentInput({
    name: "  Market Analyst  ",
    summary: "  Reviews market movement  ",
    capabilityPreset: "full",
    installedSkillIds: ["web-research", "web-research", "browser-operator"],
    memoryEnabled: false,
  });

  assert.equal(agent.name, "Market Analyst");
  assert.equal(agent.summary, "Reviews market movement");
  assert.equal(agent.capability_preset, "full");
  assert.deepEqual(agent.installed_skill_ids, ["web-research", "browser-operator"]);
  assert.equal(agent.memory_enabled, false);
  assert.equal(agent.visibility, "private");
});

test("toChatAgentDefinition includes persisted work-agent tool context", () => {
  const persisted: WorkAgent = {
    id: "agent_1",
    user_id: "user_1",
    name: "Research Lead",
    short_label: "Research",
    summary: "Coordinates market research.",
    role: "Research coordinator",
    instructions: "Use connected data before making claims.",
    system_prompt: "Be direct and source-backed.",
    model_id: "auto",
    capability_preset: "team_lead",
    workspace_scope: { mode: "none", project_id: null, path: null },
    installed_skill_ids: ["web-research"],
    memory_enabled: true,
    visibility: "private",
    source: "custom",
    built_in_key: null,
    is_active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };

  const chatAgent = toChatAgentDefinition(persisted);
  assert.equal(chatAgent.id, "agent_1");
  assert.match(chatAgent.systemPrompt, /Capability preset: team_lead/);
  assert.match(chatAgent.systemPrompt, /Built-in Rearvy abilities are always available/);
});

test("dedupeActiveWorkAgents keeps one active built-in per template", () => {
  const makeAgent = (overrides: Partial<WorkAgent>): WorkAgent => ({
    id: "agent",
    user_id: "user_1",
    name: "Client QBR Prep Agent",
    short_label: "QBR prep",
    summary: "Prepares a team for client review calls.",
    role: "Client review prep",
    instructions: "Prepare the team.",
    system_prompt: "Prepare the team.",
    model_id: "auto",
    capability_preset: "standard",
    workspace_scope: { mode: "none", project_id: null, path: null },
    installed_skill_ids: ["business-data", "web-research"],
    memory_enabled: true,
    visibility: "private",
    source: "built_in",
    built_in_key: "qbr-prep",
    is_active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  });

  const agents = dedupeActiveWorkAgents([
    makeAgent({ id: "built-in-old", built_in_key: null }),
    makeAgent({
      id: "built-in-new",
      summary: "Newer edited copy.",
      updated_at: "2026-02-01T00:00:00.000Z",
    }),
    makeAgent({
      id: "built-in-inactive",
      is_active: false,
      updated_at: "2026-03-01T00:00:00.000Z",
    }),
    makeAgent({
      id: "custom-qbr",
      source: "custom",
      built_in_key: null,
      updated_at: "2026-03-01T00:00:00.000Z",
    }),
  ]);

  assert.deepEqual(
    agents.map((agent) => agent.id),
    ["built-in-new", "custom-qbr"]
  );
  assert.equal(agents[0].summary, "Newer edited copy.");
});

test("normalizeAutomationInput stores schedule labels and run target", () => {
  const automation = normalizeAutomationInput({
    name: "Morning report",
    task: "Summarize overnight changes.",
    schedule: "weekdays",
    runTarget: "browser",
    approvalRequired: true,
  });

  assert.equal(automation.name, "Morning report");
  assert.equal(automation.schedule, "0 9 * * 1-5");
  assert.equal(automation.schedule_label, "Weekdays at 09:00");
  assert.equal(automation.run_target, "browser");
  assert.equal(automation.approval_required, true);
});

test("Automaton defaults include built-in abilities and hourly schedule", () => {
  assert.deepEqual(AUTOMATON_DEFAULT_ABILITY_IDS, [
    "web-research",
    "business-data",
    "browser-operator",
    "terminal-files",
    "commerce-ops",
    "agent-teamwork",
  ]);
  assert.deepEqual(AUTOMATON_DEFAULT_SKILL_IDS, AUTOMATON_DEFAULT_ABILITY_IDS);

  const automation = normalizeAutomationInput(
    buildDefaultAutomatonAutomationInput("automaton-agent")
  );
  assert.equal(automation.name, "Automaton 24/7 Operator");
  assert.equal(automation.schedule, "0 * * * *");
  assert.equal(automation.schedule_label, "Hourly");
  assert.equal(automation.agent_id, "automaton-agent");
});

test("Automaton backfill only refreshes legacy built-in copy", () => {
  assert.equal(
    shouldRefreshAutomatonBuiltInAgent({
      source: "built_in",
      built_in_key: "automaton",
      summary:
        "Rearvy-powered self-running business agent for daily monitoring, prioritization, and follow-up.",
      instructions: "Default to a daily operating rhythm.",
    }),
    true
  );

  assert.equal(
    shouldRefreshAutomatonBuiltInAgent({
      source: "built_in",
      built_in_key: "automaton",
      summary: "My customized Automaton",
      instructions: "Keep my custom operating style.",
    }),
    false
  );

  assert.equal(
    shouldRefreshAutomatonAutomationDefaults({
      built_in_key: "automaton-business-pulse",
      name: "Automaton Business Pulse",
      task:
        "Run the Automaton business pulse. Review connected data, tasks, automations, recent runs, source research, and channel activity. Produce a concise operating update with top signals, risks, actions queued, and what to watch next.",
    }),
    true
  );

  assert.equal(
    shouldRefreshAutomatonAutomationDefaults({
      built_in_key: "automaton-business-pulse",
      name: "My custom Automaton cycle",
      task: "Do exactly what I configured.",
    }),
    false
  );
});
