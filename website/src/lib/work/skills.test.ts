import test from "node:test";
import assert from "node:assert/strict";

import { resolveToolNamesForSkills } from "./skills";

test("resolveToolNamesForSkills maps installed skills to real tool names", () => {
  const tools = resolveToolNamesForSkills(["web-research", "terminal-files"]);

  assert.equal(tools.has("getCurrentDate"), true);
  assert.equal(tools.has("searchWeb"), true);
  assert.equal(tools.has("fetchWebPage"), true);
  assert.equal(tools.has("runTerminalCommand"), true);
  assert.equal(tools.has("planWorkflow"), true);
  assert.equal(tools.has("executeWorkflow"), true);
  assert.equal(tools.has("getRevenue"), false);
});

test("resolveToolNamesForSkills exposes desktop workflows to browser operators", () => {
  const tools = resolveToolNamesForSkills(["browser-operator"]);

  assert.equal(tools.has("runBrowserTask"), true);
  assert.equal(tools.has("planWorkflow"), true);
  assert.equal(tools.has("getWorkflowStatus"), true);
});
