"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { setupAutomationIPC } = require("./automation-integration.cjs");

test("automation IPC rejects untrusted renderers before it can start a workflow", async () => {
  const handlers = new Map();
  setupAutomationIPC({ handle: (channel, handler) => handlers.set(channel, handler) }, {
    isTrustedSender: (event) => event.sender === "rearvy",
  });

  await assert.rejects(
    () => handlers.get("desktop:automation:start-workflow")({ sender: "untrusted" }, { name: "Do not run" }),
    /untrusted renderer/
  );

  const result = await handlers.get("desktop:automation:start-workflow")({ sender: "rearvy" }, { name: "Trusted" });
  assert.equal(result.success, false);
  assert.match(result.error, /Executor not initialized/);
});
