import test from "node:test";
import assert from "node:assert/strict";

import { scoreWorkAgents } from "./automaton-quality";

function activity(overrides: Partial<{
  successfulRunsLast14: number;
  failedRunsLast14: number;
  activeAutomationRefs: number;
  activeTeamRefs: number;
}> = {}) {
  return {
    successfulRunsLast14: 0,
    failedRunsLast14: 0,
    activeAutomationRefs: 0,
    activeTeamRefs: 0,
    ...overrides,
  };
}

test("scoreWorkAgents archives only repeated low-score unreferenced custom agents", () => {
  const activityByAgentId = new Map([
    ["weak", activity()],
    ["referenced", activity({ activeAutomationRefs: 1 })],
    ["team-referenced", activity({ activeTeamRefs: 1 })],
    ["healthy", activity({ successfulRunsLast14: 2 })],
  ]);

  const scores = scoreWorkAgents({
    agents: [
      {
        id: "weak",
        name: "Weak Agent",
        source: "custom",
        built_in_key: null,
        is_active: true,
        low_score_streak: 2,
        performance_score: 2,
        updated_at: "2025-01-01T00:00:00.000Z",
      },
      {
        id: "referenced",
        name: "Referenced Agent",
        source: "custom",
        built_in_key: null,
        is_active: true,
        low_score_streak: 2,
        performance_score: 2,
        updated_at: "2025-01-01T00:00:00.000Z",
      },
      {
        id: "healthy",
        name: "Healthy Agent",
        source: "custom",
        built_in_key: null,
        is_active: true,
        low_score_streak: 0,
        performance_score: 5,
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "team-referenced",
        name: "Team Referenced Agent",
        source: "custom",
        built_in_key: null,
        is_active: true,
        low_score_streak: 2,
        performance_score: 2,
        updated_at: "2025-01-01T00:00:00.000Z",
      },
      {
        id: "built-in",
        name: "Built In",
        source: "built_in",
        built_in_key: "automaton",
        is_active: true,
        low_score_streak: 10,
        performance_score: 1,
      },
    ],
    activityByAgentId,
  });

  assert.deepEqual(
    scores.map((score) => score.agentId),
    ["weak", "referenced", "healthy", "team-referenced"]
  );
  assert.equal(scores.find((score) => score.agentId === "weak")?.archived, true);
  assert.equal(scores.find((score) => score.agentId === "referenced")?.archived, false);
  assert.equal(scores.find((score) => score.agentId === "team-referenced")?.archived, false);
  assert.equal(scores.find((score) => score.agentId === "healthy")?.qualityStatus, "healthy");
});
