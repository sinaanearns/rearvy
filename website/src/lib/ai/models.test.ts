import assert from "node:assert/strict";
import test from "node:test";
import {
  CHAT_MODEL_OPTIONS,
  DEFAULT_CHAT_MODEL_TIER,
  getAvailableChatModels,
  resolveChatModelTier,
  resolveChatProviderModel,
} from "./models.ts";

test("Kimi built-in model uses Moonshot Kimi K2.6 on NVIDIA", () => {
  assert.equal(CHAT_MODEL_OPTIONS["kimi-k2.5"].label, "Kimi K2.6");
  assert.equal(
    resolveChatProviderModel("kimi-k2.5"),
    "moonshotai/kimi-k2.6"
  );
});

test("Nemotron Omni built-in model uses NVIDIA reasoning model ID", () => {
  assert.equal(CHAT_MODEL_OPTIONS["nemotron-omni"].label, "Nemotron Omni");
  assert.equal(
    resolveChatProviderModel("nemotron-omni"),
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning"
  );
});

test("automatic routing is the default built-in chat model", () => {
  assert.equal(DEFAULT_CHAT_MODEL_TIER, "auto");
  assert.deepEqual(
    getAvailableChatModels("pro").map((model) => model.id),
    [
      "auto",
      "kimi-k2.5",
      "nemotron-omni",
      "glm-5.2",
      "glm-5.1",
      "deepseek-v4-pro",
    ]
  );
  assert.equal(resolveChatProviderModel("auto"), "auto");
  assert.equal(resolveChatModelTier("free", "pro"), "auto");
  assert.equal(resolveChatModelTier("auto", "pro"), "auto");
});

test("explicit built-in chat models still resolve to their provider IDs", () => {
  assert.equal(
    resolveChatProviderModel("deepseek-v4-pro"),
    "deepseek-ai/deepseek-v4-pro"
  );
  assert.equal(
    resolveChatProviderModel("deepseek-v4-pro", { hasImageInput: true }),
    "deepseek-ai/deepseek-v4-pro"
  );
  assert.equal(resolveChatModelTier("kimi-k2.5", "pro"), "kimi-k2.5");
});
