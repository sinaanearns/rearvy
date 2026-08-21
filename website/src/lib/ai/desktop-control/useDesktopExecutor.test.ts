import assert from "node:assert/strict";
import test from "node:test";

import {
  coerceWorkflowHistory,
  getAutomationErrorMessage,
  getAutomationResultState,
  isFailedAutomationResult,
  isWorkflowState,
} from "./useDesktopExecutor.tsx";
import type { WorkflowState } from "./types";

const VALID_STATE: WorkflowState = {
  workflowId: "workflow-1",
  completedSteps: [],
  state: "running",
  logs: [],
  errorCount: 0,
  updatedAt: "2026-06-03T00:00:00.000Z",
};

test("detects failed automation bridge results without unsafe casts", () => {
  assert.equal(isFailedAutomationResult({ ok: false, reason: "paused" }), true);
  assert.equal(isFailedAutomationResult({ success: false, error: "failed" }), true);
  assert.equal(isFailedAutomationResult({ ok: true }), false);
  assert.equal(isFailedAutomationResult(null), false);

  assert.equal(
    getAutomationErrorMessage({ ok: false, reason: "paused" }, "fallback"),
    "paused"
  );
  assert.equal(
    getAutomationErrorMessage({ success: false }, "fallback"),
    "fallback"
  );
});

test("validates workflow state payloads from the desktop bridge", () => {
  assert.equal(isWorkflowState(VALID_STATE), true);
  assert.equal(
    isWorkflowState({ ...VALID_STATE, state: "unknown" }),
    false
  );
  assert.equal(
    isWorkflowState({ ...VALID_STATE, logs: null }),
    false
  );

  assert.deepEqual(getAutomationResultState({ state: VALID_STATE }), VALID_STATE);
  assert.equal(getAutomationResultState({ state: { ...VALID_STATE, workflowId: null } }), null);
});

test("filters invalid workflow history payloads", () => {
  assert.deepEqual(
    coerceWorkflowHistory([VALID_STATE, null, { ...VALID_STATE, errorCount: "0" }]),
    [VALID_STATE]
  );
  assert.deepEqual(coerceWorkflowHistory({ items: [VALID_STATE] }), []);
});
