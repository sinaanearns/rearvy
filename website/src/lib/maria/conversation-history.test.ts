import assert from "node:assert/strict";
import { test } from "node:test";

import {
  coerceMariaConversationHistory,
  formatMariaConversationHistory,
} from "./conversation-history";

test("coerces aliases and keeps the most recent Maria turns", () => {
  const history = coerceMariaConversationHistory([
    { user: "old", assistant: "old reply" },
    { command: "screen?", reply: "The Maria dashboard is visible." },
    { userTranscript: "continue", assistantResponse: "Open the settings tab." },
  ]);

  assert.deepEqual(history, [
    { user: "old", assistant: "old reply" },
    { user: "screen?", assistant: "The Maria dashboard is visible." },
    { user: "continue", assistant: "Open the settings tab." },
  ]);
});

test("drops invalid turns and formats history for the Maria prompt", () => {
  const history = coerceMariaConversationHistory([
    { user: "What do you see?", assistant: "A checkout page." },
    { user: "missing assistant" },
    null,
  ]);

  assert.equal(history.length, 1);
  assert.equal(formatMariaConversationHistory(history), "1. User: What do you see?\n   Maria: A checkout page.");
});

test("limits history to eight turns", () => {
  const history = coerceMariaConversationHistory(
    Array.from({ length: 10 }, (_, index) => ({
      user: `user ${index}`,
      assistant: `reply ${index}`,
    }))
  );

  assert.equal(history.length, 8);
  assert.equal(history[0]?.user, "user 2");
  assert.equal(history[7]?.assistant, "reply 9");
});
