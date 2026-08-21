import assert from "node:assert/strict";
import test from "node:test";

import {
  getCloudComputerConfig,
  shouldPreferCloudComputer,
} from "./config.ts";
import {
  CLOUD_COMPUTER_LOGIN_REQUIRED_MESSAGE,
  requiresUnsupportedCloudComputerAuth,
} from "./types.ts";

const ENV_KEYS = [
  "BROWSERBASE_API_KEY",
  "BROWSERBASE_PROJECT_ID",
  "BROWSERBASE_REGION",
  "CLOUD_COMPUTER_ENABLED",
  "CLOUD_COMPUTER_MAX_ACTIVE_SESSIONS",
  "CLOUD_COMPUTER_TIMEOUT_SECONDS",
  "CLOUD_COMPUTER_STAGEHAND_MODEL",
  "NVIDIA_API_KEY",
  "VERCEL",
] as const;

function withEnv<T>(updates: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>, fn: () => T) {
  const original = Object.fromEntries(
    ENV_KEYS.map((key) => [key, process.env[key]])
  );
  try {
    for (const key of ENV_KEYS) {
      if (updates[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = updates[key];
      }
    }
    return fn();
  } finally {
    for (const key of ENV_KEYS) {
      const value = original[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("cloud computer config requires flag and Browserbase credentials", () => {
  withEnv(
    {
      CLOUD_COMPUTER_ENABLED: "true",
      BROWSERBASE_API_KEY: undefined,
      BROWSERBASE_PROJECT_ID: "project-id",
    },
    () => {
      const availability = getCloudComputerConfig();
      assert.equal(availability.available, false);
      assert.match(availability.reason || "", /BROWSERBASE_API_KEY/);
    }
  );
});

test("cloud computer config normalizes Browserbase defaults", () => {
  withEnv(
    {
      CLOUD_COMPUTER_ENABLED: "true",
      BROWSERBASE_API_KEY: "key",
      BROWSERBASE_PROJECT_ID: "project-id",
      BROWSERBASE_REGION: "invalid",
      CLOUD_COMPUTER_MAX_ACTIVE_SESSIONS: "2",
      NVIDIA_API_KEY: "model-key",
    },
    () => {
      const availability = getCloudComputerConfig();
      assert.equal(availability.available, true);
      assert.equal(availability.config?.region, "us-west-2");
      assert.equal(availability.config?.maxActiveSessions, 2);
      assert.equal(availability.config?.stagehandModel, "gpt-4.1-mini");
      assert.equal(availability.config?.modelApiKey, "model-key");
    }
  );
});

test("provider selection prefers cloud only for hosted or explicit cloud method", () => {
  withEnv({ VERCEL: undefined }, () => {
    assert.equal(
      shouldPreferCloudComputer({ requestedMethod: "cloud-browser", localAvailable: true }),
      true
    );
    assert.equal(
      shouldPreferCloudComputer({ requestedMethod: "cdp-direct", localAvailable: false }),
      false
    );
    assert.equal(
      shouldPreferCloudComputer({ requestedMethod: "auto", localAvailable: false }),
      true
    );
    assert.equal(
      shouldPreferCloudComputer({ requestedMethod: "auto", localAvailable: true }),
      false
    );
  });
});

test("cloud computer v1 refuses login and payment tasks", () => {
  assert.equal(requiresUnsupportedCloudComputerAuth("open https://example.com"), false);
  assert.equal(requiresUnsupportedCloudComputerAuth("log in to Shopify"), true);
  assert.equal(requiresUnsupportedCloudComputerAuth("complete payment checkout"), true);
  assert.match(CLOUD_COMPUTER_LOGIN_REQUIRED_MESSAGE, /cannot handle logins/i);
});
