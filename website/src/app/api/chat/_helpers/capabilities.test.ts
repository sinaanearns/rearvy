import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCapabilityResponse,
  isCapabilityQuestion,
} from "./capabilities";

test("detects generic capability questions without catching scoped requests", () => {
  assert.equal(isCapabilityQuestion("what can u do"), true);
  assert.equal(isCapabilityQuestion("What tools do you have?"), true);
  assert.equal(isCapabilityQuestion("/help"), true);
  assert.equal(isCapabilityQuestion("what can you do with this CSV?"), false);
});

test("capability response uses enabled tools and avoids unsupported 3D providers", () => {
  const response = buildCapabilityResponse({
    toolNames: [
      "getRevenue",
      "searchWeb",
      "fetchWebPage",
      "planWorkflow",
      "generateMedia",
      "analyzeMedia",
      "generateDocument",
      "mcp_hyper3d_generate_asset",
    ],
    isDesktopApp: true,
    connectedIntegrations: [{ provider: "google_analytics", status: "connected" }],
  });

  assert.match(response, /Analyze connected business data/);
  assert.match(response, /execute available tasks from chat/);
  assert.match(response, /refuse illegal, harmful/);
  assert.match(response, /research retrieval/);
  assert.match(response, /Prepare scoped desktop and system workflows/);
  assert.match(response, /file read\/list\/write/);
  assert.match(response, /product artifacts\/prototype files/);
  assert.match(response, /explicit shell commands/);
  assert.match(response, /Media Studio/);
  assert.match(response, /public media links/);
  assert.match(response, /direct public audio\/video file URLs/);
  assert.match(response, /Maria bridge/);
  assert.match(response, /slide-ready presentation outlines/);
  assert.match(response, /Use connected MCP tools/);
  assert.doesNotMatch(response, /Hyper3D|Hunyuan3D|Generate 3D assets/i);
});
