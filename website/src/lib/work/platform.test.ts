import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeAutomationInput,
  normalizeSchedule,
  normalizeWorkAgentInput,
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
  assert.match(chatAgent.systemPrompt, /Installed skills: web-research/);
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
