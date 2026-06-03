import assert from "node:assert/strict";
import test from "node:test";

import { executeAction, executeActionSequence } from "./control.ts";
import type { DesktopAction } from "./types";

test("executeAction returns a structured error when robotjs is unavailable", async (t) => {
  t.mock.method(console, "error", () => {});

  const action: DesktopAction = { type: "click", x: 10, y: 20 };
  const result = await executeAction(action);

  assert.equal(result.success, false);
  assert.equal(result.action, action);
  assert.match(result.error ?? "", /robotjs not available for click action/);
  assert.equal(typeof result.durationMs, "number");
});

test("executeActionSequence stops after the first failed native action", async (t) => {
  t.mock.method(console, "error", () => {});

  const firstAction: DesktopAction = { type: "click", x: 10, y: 20 };
  const skippedAction: DesktopAction = { type: "wait", ms: 1 };

  const results = await executeActionSequence([firstAction, skippedAction]);

  assert.equal(results.length, 1);
  assert.equal(results[0]?.success, false);
  assert.equal(results[0]?.action, firstAction);
});
