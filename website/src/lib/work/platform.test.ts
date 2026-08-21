import test from "node:test";
import assert from "node:assert/strict";

import {
  AUTOMATON_DEFAULT_ABILITY_IDS,
  AUTOMATON_DEFAULT_SKILL_IDS,
  buildDefaultAutomatonAutomationInput,
  normalizeAutomationInput,
  normalizeSchedule,
  shouldRefreshAutomatonAutomationDefaults,
} from "./platform";

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

test("normalizeAutomationInput stores schedule labels and supported run target", () => {
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

test("normalizeAutomationInput drops unsupported agent and team targets", () => {
  const automation = normalizeAutomationInput({
    name: "Legacy run",
    task: "Run old target.",
    schedule: "daily",
    runTarget: "agent",
  });

  assert.equal(automation.run_target, "sync");
  assert.equal(automation.agent_id, null);
  assert.equal(automation.team_id, null);
});

test("Automaton defaults include built-in abilities and hourly schedule", () => {
  assert.deepEqual(AUTOMATON_DEFAULT_ABILITY_IDS, [
    "web-research",
    "business-data",
    "browser-operator",
    "terminal-files",
    "commerce-ops",
    "automation-scheduler",
    "media-studio",
    "documents",
    "presentation-planning",
    "mcp-extensions",
  ]);
  assert.deepEqual(AUTOMATON_DEFAULT_SKILL_IDS, AUTOMATON_DEFAULT_ABILITY_IDS);

  const automation = normalizeAutomationInput(buildDefaultAutomatonAutomationInput());
  assert.equal(automation.name, "Automaton 24/7 Operator");
  assert.equal(automation.schedule, "0 * * * *");
  assert.equal(automation.schedule_label, "Hourly");
  assert.equal(automation.run_target, "sync");
});

test("Automaton backfill only refreshes legacy automation copy", () => {
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
