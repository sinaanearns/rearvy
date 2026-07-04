import assert from "node:assert/strict";
import test from "node:test";
import { detectOrchestrationIntent } from "./orchestration-intent";

test("detects explicit planning requests", () => {
  assert.equal(detectOrchestrationIntent("orchestrate a competitor research flow"), true);
  assert.equal(detectOrchestrationIntent("create a detailed execution plan for writing a blog post"), true);
  assert.equal(detectOrchestrationIntent("can you run a workflow to send newsletters"), true);
});

test("detects compound sequenced objectives", () => {
  assert.equal(detectOrchestrationIntent("research top shopify features and then write an email summary"), true);
  assert.equal(detectOrchestrationIntent("first search the web for google updates then save a memory"), true);
});

test("does not trigger on simple queries", () => {
  assert.equal(detectOrchestrationIntent("hello!"), false);
  assert.equal(detectOrchestrationIntent("what is shopify?"), false);
  assert.equal(detectOrchestrationIntent("send a quick email to bob"), false);
});
