import assert from "node:assert/strict";
import test from "node:test";
import { isScreenReadIntent, normalizeScreenIntentText } from "./screen-intent.ts";

test("detects explicit screen and page reading requests", () => {
  const prompts = [
    "Read my screen",
    "read my page",
    "take a screenshot and analyze it",
    "Take a screenshot and tell me what it says",
    "take scren shot and analyze it",
    "what does this page say",
    "what's on this screen",
    "tell me what you see",
    "what app do u seel",
    "which window do you see",
  ];

  for (const prompt of prompts) {
    assert.equal(isScreenReadIntent(prompt), true, prompt);
  }
});

test("normalizes common screenshot typos", () => {
  assert.equal(
    normalizeScreenIntentText("take scren shot"),
    "take screen shot"
  );
  assert.equal(
    normalizeScreenIntentText("take a screnshot"),
    "take a screenshot"
  );
  assert.equal(
    normalizeScreenIntentText("what app do u seel"),
    "what app do you see"
  );
});

test("does not hijack normal research prompts", () => {
  const prompts = [
    "research my competitors",
    "look up screenshot software",
    "what is screen capture software",
    "summarize this article about screenshots",
    "open the dashboard page",
  ];

  for (const prompt of prompts) {
    assert.equal(isScreenReadIntent(prompt), false, prompt);
  }
});
