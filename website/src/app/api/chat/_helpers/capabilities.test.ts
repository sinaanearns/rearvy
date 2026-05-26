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
      "mcp_hyper3d_generate_asset",
    ],
    isDesktopApp: true,
    connectedIntegrations: [{ provider: "google_analytics", status: "connected" }],
  });

  assert.match(response, /Analyze connected business data/);
  assert.match(response, /Research public web sources/);
  assert.match(response, /Prepare scoped desktop workflows/);
  assert.match(response, /Use connected MCP tools/);
  assert.doesNotMatch(response, /Hyper3D|Hunyuan3D|Generate 3D assets/i);
});
