import assert from "node:assert/strict";
import test from "node:test";
import {
  sanitizeFirestoreDocumentData,
  selectModelRouteCandidate,
  type ModelProviderConfig,
} from "./model-router.ts";

function provider(
  id: ModelProviderConfig["id"],
  overrides: Partial<ModelProviderConfig> = {}
): ModelProviderConfig {
  return {
    id,
    name: id,
    baseUrl: `https://${id}.example.com/v1`,
    keyEnvVar: id === "local_ollama" ? null : `${id.toUpperCase()}_API_KEY`,
    defaultModel: `${id}-text`,
    visionModel: id === "nvidia" ? `${id}-vision` : undefined,
    capabilities: ["chat", "json"],
    costTier: id === "local_ollama" ? "local" : "free",
    configured: true,
    enabled: true,
    priority: 10,
    ...overrides,
  };
}

test("prefers local inference when it is enabled and reachable", () => {
  const route = selectModelRouteCandidate([
    provider("nvidia", { priority: 20 }),
    provider("local_ollama", { priority: 10 }),
  ]);

  assert.equal(route.provider?.id, "local_ollama");
  assert.equal(route.providerModel, "local_ollama-text");
});

test("uses an installed Ollama chat model when the configured default is missing", () => {
  const route = selectModelRouteCandidate([
    provider("local_ollama", {
      priority: 10,
      defaultModel: "llama3.1:8b",
      health: {
        status: "available",
        checkedAt: new Date(0).toISOString(),
        availableModels: ["qwen2.5:7b", "nomic-embed-text:latest"],
      },
    }),
  ]);

  assert.equal(route.provider?.id, "local_ollama");
  assert.equal(route.providerModel, "qwen2.5:7b");
});

test("falls back when the configured Ollama model is not installed", () => {
  const route = selectModelRouteCandidate([
    provider("local_ollama", {
      priority: 10,
      defaultModel: "llama3.1:8b",
      health: {
        status: "available",
        checkedAt: new Date(0).toISOString(),
        availableModels: [],
      },
    }),
    provider("nvidia", { priority: 20, costTier: "free" }),
  ]);

  assert.equal(route.provider?.id, "nvidia");
  assert.deepEqual(route.decision.fallbacksTried, ["local_ollama"]);
});

test("falls back to NVIDIA before lower-priority cloud providers", () => {
  const route = selectModelRouteCandidate([
    provider("local_ollama", {
      priority: 10,
      health: {
        status: "unreachable",
        checkedAt: new Date(0).toISOString(),
      },
    }),
    provider("groq", { priority: 30, costTier: "low" }),
    provider("nvidia", { priority: 20, costTier: "free" }),
  ]);

  assert.equal(route.provider?.id, "nvidia");
  assert.deepEqual(route.decision.fallbacksTried, ["local_ollama"]);
});

test("uses OpenRouter before NVIDIA when both free providers are available", () => {
  const route = selectModelRouteCandidate([
    provider("nvidia", { priority: 30, costTier: "free" }),
    provider("openrouter", { priority: 20, costTier: "free" }),
  ]);

  assert.equal(route.provider?.id, "openrouter");
});

test("maps legacy NVIDIA Ministral IDs to OpenRouter's current model ID", () => {
  const route = selectModelRouteCandidate(
    [provider("openrouter", { priority: 20, costTier: "free" })],
    {
      requestedProviderModel: "mistralai/ministral-14b-instruct-2512",
    }
  );

  assert.equal(route.provider?.id, "openrouter");
  assert.equal(route.providerModel, "mistralai/ministral-14b-2512");
});

test("routes JSON classification only to JSON-capable providers", () => {
  const route = selectModelRouteCandidate(
    [
      provider("openrouter", {
        priority: 20,
        capabilities: ["chat"],
      }),
      provider("nvidia", {
        priority: 30,
        capabilities: ["chat", "json"],
      }),
    ],
    { task: "json_classification" }
  );

  assert.equal(route.provider?.id, "nvidia");
  assert.deepEqual(route.decision.requiredCapabilities, ["chat", "json"]);
});

test("does not use premium providers unless premium is allowed", () => {
  const route = selectModelRouteCandidate([
    provider("openai", { priority: 10, costTier: "premium" }),
    provider("groq", { priority: 40, costTier: "low" }),
  ]);

  assert.equal(route.provider, null);
  assert.equal(route.providerModel, null);

  const premiumRoute = selectModelRouteCandidate(
    [provider("openai", { priority: 10, costTier: "premium" })],
    { allowPremium: true, maxCostTier: "premium" }
  );

  assert.equal(premiumRoute.provider?.id, "openai");
});

test("skips unconfigured providers without throwing", () => {
  const route = selectModelRouteCandidate([
    provider("local_ollama", { configured: false, enabled: false }),
    provider("nvidia", { configured: false, enabled: false }),
  ]);

  assert.equal(route.provider, null);
  assert.equal(route.providerModel, null);
  assert.ok(route.decision.unavailableReason);
});

test("requires vision capability for image input", () => {
  const route = selectModelRouteCandidate(
    [
      provider("local_ollama", { priority: 10 }),
      provider("nvidia", {
        priority: 20,
        capabilities: ["chat", "vision", "json"],
      }),
    ],
    { hasImageInput: true, requestedProviderModel: "requested-nvidia-model" }
  );

  assert.equal(route.provider?.id, "nvidia");
  assert.equal(route.providerModel, "nvidia-vision");
});

test("removes nested undefined fields from Firestore telemetry data", () => {
  const sanitized = sanitizeFirestoreDocumentData({
    usage: {
      inputTokenDetails: {
        cacheReadTokens: 10,
        cacheWriteTokens: undefined,
      },
    },
    route: {
      fallbacksTried: [undefined, "openrouter"],
    },
  });

  assert.deepEqual(sanitized, {
    usage: {
      inputTokenDetails: {
        cacheReadTokens: 10,
      },
    },
    route: {
      fallbacksTried: [null, "openrouter"],
    },
  });
});
