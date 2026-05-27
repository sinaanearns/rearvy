import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeAssistantText } from "./sanitize.ts";

test("removes complete hidden reasoning blocks", () => {
  assert.equal(
    sanitizeAssistantText("<think>hidden non-English reasoning</think>\n\nSure, I can help."),
    "Sure, I can help."
  );
});

test("removes dangling reasoning prefixes from streamed text", () => {
  assert.equal(
    sanitizeAssistantText("hidden leaked prefix </think>\n\nSure, I can help with the mouse issue."),
    "Sure, I can help with the mouse issue."
  );
});

test("hides unfinished reasoning blocks while streaming", () => {
  assert.equal(
    sanitizeAssistantText("Before\n\n<think>hidden partial reasoning"),
    "Before"
  );
});
