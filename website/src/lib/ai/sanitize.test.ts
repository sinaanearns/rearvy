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

test("handles missing provider text", () => {
  assert.equal(sanitizeAssistantText(undefined), "");
  assert.equal(sanitizeAssistantText(null), "");
});

test("replaces leaked visual-labeling instructions with a useful fallback", () => {
  assert.equal(
    sanitizeAssistantText(
      "(difficult) [A-Z] for the app name: Please use [Z] or [X] to mark app name, and use [1] or [2] for the app type."
    ),
    "I could not read that screen-analysis response clearly. I will treat this as a screen-reading request; approve the screenshot workflow, then I can tell you what is visible."
  );
});
