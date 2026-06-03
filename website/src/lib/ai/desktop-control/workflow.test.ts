import assert from "node:assert/strict";
import test from "node:test";

import { WorkflowExecutor } from "./workflow.ts";
import type { Workflow } from "./types";

function createToolWorkflow(): Workflow {
  return {
    id: "workflow-tool-test",
    name: "Tool workflow test",
    userId: "user-1",
    type: "novel",
    state: "draft",
    steps: [
      {
        id: "step_tool",
        name: "Run tool",
        action: {
          type: "tool",
          toolName: "mockTool",
          params: { value: 1 },
        },
      },
    ],
    approvalPoints: [],
    createdAt: "2026-06-03T00:00:00.000Z",
    logs: [],
  };
}

test("workflow executor preserves tool calls in action results", async () => {
  const workflow = createToolWorkflow();
  const executor = new WorkflowExecutor(workflow, {
    toolExecutor: async (toolCall) => ({
      toolName: toolCall.toolName,
      params: toolCall.params,
    }),
  });

  await executor.start();

  const state = executor.getState();
  assert.equal(state.state, "completed");
  assert.deepEqual(state.completedSteps, ["step_tool"]);
  assert.equal(state.errorCount, 0);
  assert.deepEqual(state.lastAction?.result.action, workflow.steps[0]?.action);
  assert.deepEqual(state.lastAction?.result.output, {
    toolName: "mockTool",
    params: { value: 1 },
  });
});

test("workflow executor counts a fatal tool-step failure once", async () => {
  const executor = new WorkflowExecutor(createToolWorkflow());

  await executor.start();

  const state = executor.getState();
  assert.equal(state.state, "failed");
  assert.equal(state.errorCount, 1);
  assert.equal(state.logs.length, 1);
  assert.equal(state.logs[0]?.status, "failed");
  assert.match(state.logs[0]?.errorMessage || "", /No tool executor registered/);
});
