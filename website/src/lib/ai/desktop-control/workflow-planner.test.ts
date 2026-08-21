import assert from "node:assert/strict";
import test from "node:test";

import {
  parseWorkflowPlanResponse,
  validateWorkflowPlan,
  type WorkflowPlan,
} from "./workflow-planner.tsx";

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

test("parseWorkflowPlanResponse parses fenced workflow JSON", () => {
  const plan = parseWorkflowPlanResponse(
    `\`\`\`json
{
  "name": "Open Notepad",
  "description": "Launches Notepad",
  "steps": [
    {
      "id": "step_1",
      "name": "Launch app",
      "action": { "type": "launchApp", "appPath": "notepad.exe" },
      "timeout": 5000
    }
  ],
  "reasoning": "Simple launch task",
  "confidence": 1.4,
  "requiresApproval": false
}
\`\`\``,
    "user_1",
    123
  );

  assert.equal(plan.workflowId, "novel_123");
  assert.equal(plan.name, "Open Notepad");
  assert.equal(plan.confidence, 1);
  assert.equal(plan.requiresApproval, false);
  assert.deepEqual(plan.steps[0].action, {
    type: "launchApp",
    appPath: "notepad.exe",
    args: [],
    wait: true,
  });
});

test("parseWorkflowPlanResponse extracts the first balanced object without swallowing trailing braces", () => {
  const plan = parseWorkflowPlanResponse(
    `Plan:
{
  "name": "Wait {safely}",
  "description": "Uses a wait step",
  "steps": [
    { "id": "step_1", "name": "Wait", "action": { "type": "wait", "ms": 1000 } }
  ],
  "reasoning": "The task only needs a wait.",
  "confidence": 0.75
}
Trailing {not json}`,
    "user_1",
    456
  );

  assert.equal(plan.workflowId, "novel_456");
  assert.equal(plan.name, "Wait {safely}");
  assert.equal(plan.confidence, 0.75);
  assert.equal(plan.requiresApproval, true);
  assert.deepEqual(plan.steps[0].action, { type: "wait", ms: 1000 });
});

test("parseWorkflowPlanResponse rejects missing workflow JSON", () => {
  assert.throws(
    () => parseWorkflowPlanResponse("No structured plan here.", "user_1", 789),
    /No workflow plan JSON object found/
  );
});
