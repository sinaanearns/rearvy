import assert from "node:assert/strict";
import test, { describe } from "node:test";
import type { WorkflowExecutionStep } from "@/lib/firebase/schema";
import {
  blockStepsWithFailedDependencies,
  getReadyWorkflowStepIndexes,
  summarizeWorkflowState,
  validateWorkflowGraph,
} from "./workflow-runtime";

function step(
  id: string,
  status: WorkflowExecutionStep["status"],
  dependsOn: string[] = []
): WorkflowExecutionStep {
  return {
    id,
    name: id,
    capability: "search",
    status,
    depends_on: dependsOn,
    input: {},
  };
}

describe("Rearvy workflow runtime", () => {
  test("runs only steps whose dependencies succeeded", () => {
    const steps = [
      step("research", "succeeded"),
      step("edit", "pending", ["research"]),
      step("publish", "pending", ["edit"]),
      step("independent", "pending"),
    ];

    assert.deepEqual(getReadyWorkflowStepIndexes(steps), [1, 3]);
  });

  test("blocks downstream branches after an execution failure", () => {
    const blocked = blockStepsWithFailedDependencies([
      step("source", "failed"),
      step("clip", "pending", ["source"]),
      step("render", "pending", ["clip"]),
      step("inspiration", "succeeded"),
    ]);

    assert.equal(blocked[1]?.status, "blocked");
    assert.equal(blocked[2]?.status, "blocked");
    assert.equal(blocked[3]?.status, "succeeded");
  });

  test("keeps independent safe work while approval is pending", () => {
    const summary = summarizeWorkflowState([
      step("research", "succeeded"),
      step("publish", "awaiting_approval", ["research"]),
    ]);

    assert.equal(summary.status, "waiting");
    assert.equal(summary.needsApproval, true);
    assert.match(summary.summary, /1 completed/);
  });

  test("reports partial completion instead of false success", () => {
    const summary = summarizeWorkflowState([
      step("research", "succeeded"),
      step("edit", "failed", ["research"]),
      step("publish", "blocked", ["edit"]),
    ]);

    assert.equal(summary.status, "partially_completed");
    assert.match(summary.summary, /1 succeeded/);
  });

  test("rejects missing, duplicate, self, and cyclic dependencies", () => {
    assert.match(validateWorkflowGraph([step("a", "pending"), step("a", "pending")]).join(" "), /duplicated/);
    assert.match(validateWorkflowGraph([step("a", "pending", ["missing"])]).join(" "), /missing/);
    assert.match(validateWorkflowGraph([step("a", "pending", ["a"])]).join(" "), /itself/);
    assert.match(
      validateWorkflowGraph([
        step("a", "pending", ["b"]),
        step("b", "pending", ["a"]),
      ]).join(" "),
      /cycle/
    );
  });
});
