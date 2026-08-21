import test from "node:test";
import assert from "node:assert/strict";

import { parseMarkdownTaskListItem } from "./chat-list-items.ts";

test("parseMarkdownTaskListItem parses checked and unchecked task items", () => {
  assert.deepEqual(parseMarkdownTaskListItem("[x] Shipped"), {
    checked: true,
    content: "Shipped",
  });
  assert.deepEqual(parseMarkdownTaskListItem("[X] Reviewed"), {
    checked: true,
    content: "Reviewed",
  });
  assert.deepEqual(parseMarkdownTaskListItem("[ ] Needs approval"), {
    checked: false,
    content: "Needs approval",
  });
});

test("parseMarkdownTaskListItem preserves item content for inline markdown rendering", () => {
  assert.deepEqual(parseMarkdownTaskListItem("[ ] Review **bold** link"), {
    checked: false,
    content: "Review **bold** link",
  });
});

test("parseMarkdownTaskListItem ignores ordinary list items", () => {
  assert.equal(parseMarkdownTaskListItem("Regular [x] marker"), null);
  assert.equal(parseMarkdownTaskListItem("[?] Unknown marker"), null);
});
