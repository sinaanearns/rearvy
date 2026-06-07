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

test("unwraps raw JSON text part arrays", () => {
  assert.equal(
    sanitizeAssistantText(
      JSON.stringify([
        { type: "text", text: "First paragraph" },
        { type: "tool-call", text: "ignored" },
        { type: "text", text: "Second paragraph" },
      ])
    ),
    "First paragraph\n\nSecond paragraph"
  );
});

test("unwraps partial JSON text wrappers with escaped content", () => {
  assert.equal(
    sanitizeAssistantText('[{"type":"text","text":"Hello\\nworld"}'),
    "Hello\nworld"
  );
});

test("keeps malformed JSON text wrappers as plain text", () => {
  assert.equal(
    sanitizeAssistantText('[{"type":"text","text":"Hello\\q"}]'),
    '[{"type":"text","text":"Hello\\q"}]'
  );
});

test("replaces leaked visual-labeling instructions with a useful fallback", () => {
  assert.equal(
    sanitizeAssistantText(
      "(difficult) [A-Z] for the app name: Please use [Z] or [X] to mark app name, and use [1] or [2] for the app type."
    ),
    "I could not read that screen-analysis response clearly. I will treat this as a screen-reading request and start a screenshot workflow so I can tell you what is visible."
  );
});

test("rewrites legacy screenshot approval copy", () => {
  assert.equal(
    sanitizeAssistantText(
      "I prepared a desktop screenshot workflow. Approve it in the Desktop Workspace to capture the screen."
    ),
    "I prepared a desktop screenshot workflow. It will run automatically in the Desktop Workspace."
  );
});
