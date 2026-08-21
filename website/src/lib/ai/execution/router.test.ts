import assert from "node:assert/strict";
import test from "node:test";
import {
  ExecutionIntentSchema,
  EXECUTION_INTENT_CATEGORIES,
  parseExecutionIntent,
} from "./router";

test("ExecutionIntentSchema accepts a valid browser intent", () => {
  const parsed = ExecutionIntentSchema.parse({
    category: "browser",
    action: "open spotify web player",
    parameters: { url: "https://open.spotify.com" },
    confidence: 0.8,
    requiresMultiStep: false,
    sensitivity: "safe",
  });
  assert.equal(parsed.category, "browser");
  assert.equal(parsed.requiresMultiStep, false);
});

test("ExecutionIntentSchema applies defaults", () => {
  const parsed = ExecutionIntentSchema.parse({
    category: "chat",
    action: "hello",
  });
  assert.equal(parsed.confidence, 0.5);
  assert.equal(parsed.requiresMultiStep, false);
  assert.equal(parsed.sensitivity, "safe");
  assert.deepEqual(parsed.parameters, {});
});

test("ExecutionIntentSchema rejects invalid category", () => {
  assert.throws(() =>
    ExecutionIntentSchema.parse({ category: "teleport", action: "x" })
  );
});

test("execution intent categories include all 15 capability domains", () => {
  assert.ok(EXECUTION_INTENT_CATEGORIES.includes("browser"));
  assert.ok(EXECUTION_INTENT_CATEGORIES.includes("desktop"));
  assert.ok(EXECUTION_INTENT_CATEGORIES.includes("trading"));
  assert.ok(EXECUTION_INTENT_CATEGORIES.includes("automation"));
  assert.equal(EXECUTION_INTENT_CATEGORIES.length, 15);
});

test("parseExecutionIntent falls back to keyword heuristic without LLM", async () => {
  const intent = await parseExecutionIntent("open VS Code and run the dev server");
  // "open" legitimately matches browser/desktop keywords in the fallback heuristic.
  assert.ok(
    intent.category === "browser" ||
      intent.category === "desktop" ||
      intent.category === "code" ||
      intent.category === "terminal"
  );
  assert.equal(typeof intent.confidence, "number");
});
