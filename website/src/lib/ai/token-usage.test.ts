import assert from "node:assert/strict";
import test from "node:test";
import {
  DEEPSEEK_V4_PRO_CONTEXT_WINDOW_TOKENS,
  buildChatTokenUsageMetadata,
  getChatContextWindowTokens,
  isChatTokenUsageMetadata,
} from "./token-usage.ts";

test("uses the DeepSeek V4 Pro context window", () => {
  assert.equal(
    getChatContextWindowTokens("deepseek-ai/deepseek-v4-pro"),
    DEEPSEEK_V4_PRO_CONTEXT_WINDOW_TOKENS
  );
});

test("builds provider usage with remaining context tokens", () => {
  const usage = buildChatTokenUsageMetadata({
    providerModel: "deepseek-ai/deepseek-v4-pro",
    maxOutputTokens: 8192,
    usage: {
      inputTokens: 1200,
      outputTokens: 300,
      totalTokens: 1500,
      outputTokenDetails: {
        reasoningTokens: 50,
      },
    },
  });

  assert.equal(usage.source, "provider");
  assert.equal(usage.inputTokens, 1200);
  assert.equal(usage.outputTokens, 300);
  assert.equal(usage.totalTokens, 1500);
  assert.equal(usage.reasoningTokens, 50);
  assert.equal(usage.remainingTokens, DEEPSEEK_V4_PRO_CONTEXT_WINDOW_TOKENS - 1500);
  assert.equal(isChatTokenUsageMetadata(usage), true);
});

test("falls back to the full budget before provider usage arrives", () => {
  const usage = buildChatTokenUsageMetadata({
    providerModel: "deepseek-ai/deepseek-v4-pro",
  });

  assert.equal(usage.source, "budget");
  assert.equal(usage.totalTokens, 0);
  assert.equal(usage.remainingTokens, DEEPSEEK_V4_PRO_CONTEXT_WINDOW_TOKENS);
});
