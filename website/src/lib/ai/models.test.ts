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

test("Rearvy General 5.5 and Rearvy Expert 2.7 built-in models exist", () => {
  assert.equal(CHAT_MODEL_OPTIONS["rearvy-general-5.5"].label, "Rearvy General 5.5");
  assert.equal(CHAT_MODEL_OPTIONS["rearvy-expert-2.7"].label, "Rearvy Expert 2.7");
  assert.ok(resolveChatProviderModel("rearvy-general-5.5"));
  assert.ok(resolveChatProviderModel("rearvy-expert-2.7"));
});

test("Rearvy General 5.5 is default chat model and appears in available models", () => {
  assert.equal(DEFAULT_CHAT_MODEL_TIER, "rearvy-general-5.5");
  assert.deepEqual(
    getAvailableChatModels("pro").map((model) => model.id),
    [
      "rearvy-general-5.5",
      "rearvy-expert-2.7",
    ]
  );
  assert.equal(resolveChatModelTier("free", "pro"), "rearvy-general-5.5");
  assert.equal(resolveChatModelTier("rearvy-general-5.5", "pro"), "rearvy-general-5.5");
  assert.equal(resolveChatModelTier("rearvy-expert-2.7", "pro"), "rearvy-expert-2.7");
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
