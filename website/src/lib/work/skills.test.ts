import test from "node:test";
import assert from "node:assert/strict";

import { BUILT_IN_ABILITY_IDS } from "./abilities";
import {
  getActiveMcpServerId,
  resolveToolNamesForAbilities,
  resolveToolNamesForSkills,
} from "./skills";

test("resolveToolNamesForSkills maps legacy skill ids to real tool names", () => {
  const tools = resolveToolNamesForSkills(["web-research", "terminal-files"]);

  assert.equal(tools.has("getCurrentDate"), true);
  assert.equal(tools.has("askUser"), true);
  assert.equal(tools.has("requestBrowserConnection"), true);
  assert.equal(tools.has("searchWeb"), true);
  assert.equal(tools.has("fetchWebPage"), true);
  assert.equal(tools.has("runTerminalCommand"), true);
  assert.equal(tools.has("planWorkflow"), true);
  assert.equal(tools.has("executeWorkflow"), true);
  assert.equal(tools.has("getRevenue"), false);
});

test("resolveToolNamesForAbilities exposes every built-in Rearvy ability", () => {
  const tools = resolveToolNamesForAbilities(BUILT_IN_ABILITY_IDS);

  assert.equal(tools.has("searchWeb"), true);
  assert.equal(tools.has("getRevenue"), true);
  assert.equal(tools.has("runBrowserTask"), true);
  assert.equal(tools.has("requestBrowserConnection"), true);
  assert.equal(tools.has("runTerminalCommand"), true);
  assert.equal(tools.has("prepareGmailMessage"), true);
  assert.equal(tools.has("delegateToSpecialistAgent"), true);
  assert.equal(tools.has("planWorkflow"), true);
  assert.equal(tools.has("getWorkflowStatus"), true);
  assert.equal(tools.has("generateMedia"), true);
  assert.equal(tools.has("analyzeMedia"), true);
  assert.equal(tools.has("generateDocument"), true);
  assert.equal(tools.has("spawnAgentTeam"), true);
});

test("getActiveMcpServerId uses the document id and ignores stored id fields", () => {
  assert.equal(
    getActiveMcpServerId("doc-server", {
      id: "stored-server",
      is_active: true,
    }),
    "doc-server"
  );
  assert.equal(getActiveMcpServerId("doc-server", { is_active: false }), null);
  assert.equal(getActiveMcpServerId("doc-server", null), "doc-server");
});
