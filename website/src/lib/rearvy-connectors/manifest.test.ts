import assert from "node:assert/strict";
import test, { describe } from "node:test";
import {
  renderCapabilitiesMarkdown,
  validateConnectorManifest,
} from "./manifest";

const blenderManifest = {
  schemaVersion: "1.0" as const,
  id: "blender",
  displayName: "Blender",
  description: "Local Blender editing capabilities exposed through a Rearvy bridge.",
  version: "1.0.0",
  publisher: "Rearvy",
  transport: "local_bridge" as const,
  privacy: "private" as const,
  capabilities: [
    {
      id: "blender.object.move",
      name: "Move object",
      description: "Move a selected Blender object on the X, Y, or Z axis.",
      risk: "write" as const,
      approvalRequired: true,
      inputSchema: { type: "object", required: ["object", "axis", "distance"] },
      outputSchema: { type: "object", properties: { object: { type: "string" } } },
    },
    {
      id: "blender.scene.inspect",
      name: "Inspect scene",
      description: "Read the objects and cameras in the current Blender scene.",
      risk: "read" as const,
      approvalRequired: false,
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    },
  ],
  requiredScopes: ["blender.scene.read", "blender.scene.write"],
  webhookEvents: [],
};

describe("Rearvy connector manifest", () => {
  test("accepts a valid private connector", () => {
    const result = validateConnectorManifest(blenderManifest);
    assert.equal(result.success, true);
  });

  test("rejects duplicate capability IDs", () => {
    const result = validateConnectorManifest({
      ...blenderManifest,
      capabilities: [blenderManifest.capabilities[0], blenderManifest.capabilities[0]],
    });
    assert.equal(result.success, false);
    if (!result.success) {
      assert.match(result.error.issues[0]?.message ?? "", /unique/i);
    }
  });

  test("requires approval for write capabilities", () => {
    const result = validateConnectorManifest({
      ...blenderManifest,
      capabilities: [{ ...blenderManifest.capabilities[0], approvalRequired: false }],
    });
    assert.equal(result.success, false);
  });

  test("renders an explicit external-capabilities contract", () => {
    const result = validateConnectorManifest(blenderManifest);
    assert.equal(result.success, true);
    if (!result.success) return;

    const markdown = renderCapabilitiesMarkdown(result.data);
    assert.match(markdown, /not native features of this codebase/i);
    assert.match(markdown, /blender\.object\.move/);
    assert.match(markdown, /Do not upload source code/);
  });
});

