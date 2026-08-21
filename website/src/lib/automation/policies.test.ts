import assert from "node:assert/strict";
import test from "node:test";
import {
  canRunAutomationLayer,
  getDefaultAutomationPolicy,
  normalizeAutomationPolicyPatch,
} from "./policies.ts";

test("default automation policy starts in insights-only mode", () => {
  const policy = getDefaultAutomationPolicy("user_123");

  assert.equal(policy.layer, 1);
  assert.equal(policy.desktop_permissions.filesystem, false);
  assert.equal(policy.desktop_permissions.appControl, false);
  assert.equal(policy.desktop_permissions.browserControl, false);
  assert.equal(policy.desktop_permissions.shellCommands, false);
  assert.equal(policy.audit_enabled, true);
  assert.equal(policy.require_approval_for.includes("wallet.transaction"), true);
});

test("policy patch clamps risky settings and blocks shell permission", () => {
  const policy = getDefaultAutomationPolicy("user_123");
  const updated = normalizeAutomationPolicyPatch(
    {
      layer: 4,
      allowed_scopes: [
        "insights",
        "filesystem.write",
        "integrations.read",
        "unknown.scope",
      ],
      require_approval_for: ["gmail.send", "unknown.write"],
      desktop_permissions: {
        filesystem: true,
        appControl: true,
        browserControl: true,
        shellCommands: true,
      },
      rate_limits: {
        maxRunsPerHour: 999,
        maxActionsPerRun: 999,
      },
    },
    policy
  );

  assert.equal(updated.layer, 4);
  assert.deepEqual(updated.allowed_scopes, ["insights", "integrations.read"]);
  assert.deepEqual(updated.require_approval_for, ["gmail.send", "wallet.transaction"]);
  assert.equal(updated.desktop_permissions.shellCommands, false);
  assert.equal(updated.rate_limits.maxRunsPerHour, 100);
  assert.equal(updated.rate_limits.maxActionsPerRun, 25);
});

test("wallet transactions always remain approval-required", () => {
  const policy = getDefaultAutomationPolicy("user_123");
  const updated = normalizeAutomationPolicyPatch(
    {
      require_approval_for: [],
    },
    policy
  );

  assert.equal(updated.require_approval_for.includes("wallet.transaction"), true);
});

test("automation layers only run when policy allows them", () => {
  const policy = {
    ...getDefaultAutomationPolicy("user_123"),
    layer: 2 as const,
  };

  assert.equal(canRunAutomationLayer(policy, 1), true);
  assert.equal(canRunAutomationLayer(policy, 2), true);
  assert.equal(canRunAutomationLayer(policy, 3), false);
});
