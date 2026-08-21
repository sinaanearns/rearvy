import assert from "node:assert/strict";
import test, { describe } from "node:test";
import {
  canApplyConnectorLifecycleAction,
  createConnectorDefinitionId,
  hasReviewableSandboxSubmission,
  nextConnectorLifecycleStatus,
  nextConnectorReviewStatus,
  readSandboxSubmission,
  validateConnectorContract,
} from "./publisher-registry";

const manifest = {
  schemaVersion: "1.0",
  id: "video-editor",
  displayName: "Video Editor",
  description: "Edits and renders user-owned video projects.",
  version: "1.2.0",
  publisher: "Example Studio",
  transport: "mcp",
  privacy: "private",
  capabilities: [
    {
      id: "video.render",
      name: "Render video",
      description: "Render an approved video timeline.",
      risk: "write",
      approvalRequired: true,
      inputSchema: { type: "object", required: ["timeline"] },
      outputSchema: { type: "object" },
    },
  ],
};

describe("connector publisher registry", () => {
  test("validates a connector before it enters sandbox", () => {
    const result = validateConnectorContract(manifest, new Date("2026-08-21T00:00:00.000Z"));
    assert.equal(result.passed, true);
    assert.equal(result.manifest?.id, "video-editor");
    assert.equal(result.validated_at, "2026-08-21T00:00:00.000Z");
  });

  test("returns field-level contract validation errors", () => {
    const result = validateConnectorContract({ ...manifest, version: "latest" });
    assert.equal(result.passed, false);
    assert.match(result.errors.join(" "), /version/i);
  });

  test("enforces draft, sandbox, and review transitions", () => {
    assert.equal(canApplyConnectorLifecycleAction("draft", "submit_review"), false);
    assert.equal(nextConnectorLifecycleStatus("draft", "validate_contract"), "sandbox");
    assert.equal(nextConnectorLifecycleStatus("sandbox", "submit_review"), "in_review");
    assert.equal(nextConnectorLifecycleStatus("in_review", "return_to_draft"), "draft");
    assert.throws(
      () => nextConnectorLifecycleStatus("published", "return_to_draft"),
      /not allowed/
    );
  });

  test("reserves verification and publishing for the review lifecycle", () => {
    assert.equal(nextConnectorReviewStatus("in_review", "verify"), "verified");
    assert.equal(nextConnectorReviewStatus("verified", "publish"), "published");
    assert.equal(nextConnectorReviewStatus("in_review", "reject"), "draft");
    assert.equal(nextConnectorReviewStatus("published", "suspend"), "suspended");
    assert.throws(() => nextConnectorReviewStatus("draft", "publish"), /not allowed/);
  });

  test("review submission never accepts credentials embedded in URLs", () => {
    const invalid = readSandboxSubmission({
      endpoint: "https://user:secret@example.com/mcp",
      test_instructions: "Run the local conformance suite.",
    });
    assert.equal(invalid.endpoint, null);
    assert.equal(hasReviewableSandboxSubmission(invalid), true);
  });

  test("builds deterministic versioned publisher document IDs", () => {
    assert.equal(
      createConnectorDefinitionId("user_1", "video-editor", "1.2.0"),
      "user_1__video-editor__1_2_0"
    );
  });
});
