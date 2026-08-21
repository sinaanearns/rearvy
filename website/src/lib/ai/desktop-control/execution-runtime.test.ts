import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionRuntime } from "./execution-runtime.tsx";

test("validateAction accepts safe click coordinates", async () => {
  const runtime = new ExecutionRuntime();

  assert.deepEqual(await runtime.validateAction("user-1", "click", { x: 100, y: 200 }), {
    valid: true,
  });
});

test("validateAction rejects invalid click coordinates", async () => {
  const runtime = new ExecutionRuntime();

  assert.deepEqual(
    await runtime.validateAction("user-1", "click", { x: "100", y: 200 }),
    { valid: false, reason: "Invalid click coordinates" }
  );
  assert.deepEqual(
    await runtime.validateAction("user-1", "click", { x: 4000, y: 200 }),
    { valid: false, reason: "Click coordinates out of screen bounds" }
  );
});

test("validateAction rejects dangerous operations and oversized typing", async () => {
  const runtime = new ExecutionRuntime();

  assert.deepEqual(await runtime.validateAction("user-1", "deleteFile", {}), {
    valid: false,
    reason: "Action 'deleteFile' requires explicit approval",
  });
  assert.deepEqual(
    await runtime.validateAction("user-1", "type", { text: "x".repeat(10001) }),
    { valid: false, reason: "Text too long (max 10000 chars)" }
  );
});
