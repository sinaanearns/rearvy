import assert from "node:assert/strict";
import test from "node:test";

import { validateWorkflowPlan, type WorkflowPlan } from "./workflow-planner.tsx";

function createPlan(overrides: Partial<WorkflowPlan> = {}): WorkflowPlan {
  return {
    workflowId: "workflow-plan-test",
    name: "Workflow plan test",
    description: "Test plan",
    reasoning: "Test reasoning",
    confidence: 0.9,
    requiresApproval: true,
    steps: [
      {
        id: "step_1",
        name: "Wait",
        action: { type: "wait", ms: 1000 },
        timeout: 5000,
      },
    ],
    ...overrides,
  };
}

test("validateWorkflowPlan rejects circular dependencies", () => {
  const result = validateWorkflowPlan(
    createPlan({
      steps: [
        {
          id: "step_1",
          name: "First",
          action: { type: "wait", ms: 1000 },
          dependsOn: ["step_2"],
        },
        {
          id: "step_2",
          name: "Second",
          action: { type: "wait", ms: 1000 },
          dependsOn: ["step_1"],
        },
      ],
    })
  );

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("Workflow has circular dependencies"));
});

test("validateWorkflowPlan warns when dangerous actions lack approval", () => {
  const result = validateWorkflowPlan(
    createPlan({
      requiresApproval: false,
      steps: [
        {
          id: "step_remove",
          name: "Remove files",
          action: { type: "shellCommand", command: "remove old files" },
          timeout: 5000,
        },
      ],
    })
  );

  assert.equal(result.valid, true);
  assert.deepEqual(result.warnings, ["Step step_remove performs dangerous operation but approval not required"]);
});
