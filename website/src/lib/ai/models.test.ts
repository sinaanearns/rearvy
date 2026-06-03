import assert from "node:assert/strict";
import test from "node:test";
import {
  CHAT_MODEL_OPTIONS,
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

test("only DeepSeek V4 Pro is available as a built-in chat model", () => {
  assert.deepEqual(
    getAvailableChatModels("pro").map((model) => model.id),
    ["deepseek-v4-pro"]
  );
  assert.equal(
    resolveChatProviderModel("deepseek-v4-pro"),
    "deepseek-ai/deepseek-v4-pro"
  );
  assert.equal(
    resolveChatProviderModel("deepseek-v4-pro", { hasImageInput: true }),
    "deepseek-ai/deepseek-v4-pro"
  );
  assert.equal(resolveChatModelTier("auto", "pro"), "deepseek-v4-pro");
  assert.equal(resolveChatModelTier("kimi-k2.5", "pro"), "deepseek-v4-pro");
});
