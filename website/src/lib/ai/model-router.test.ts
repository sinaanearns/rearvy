import assert from "node:assert/strict";
import test from "node:test";
import {
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
