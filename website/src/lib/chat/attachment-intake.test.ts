import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_CHAT_ATTACHMENTS_PER_MESSAGE,
  MAX_CHAT_ATTACHMENT_SIZE_BYTES,
} from "./attachments.ts";
import { selectChatAttachmentFiles } from "./attachment-intake.ts";

function file(name: string, size: number) {
  return { name, size };
}

test("selectChatAttachmentFiles accepts files within count and size limits", () => {
  const result = selectChatAttachmentFiles([
    file("one.png", 1024),
    file("two.pdf", 2048),
  ]);

  assert.deepEqual(result.accepted.map((item) => item.name), [
    "one.png",
    "two.pdf",
  ]);
  assert.deepEqual(result.rejected, []);
});

test("selectChatAttachmentFiles rejects files over the chat attachment size limit", () => {
  const result = selectChatAttachmentFiles([
    file("large.mov", MAX_CHAT_ATTACHMENT_SIZE_BYTES + 1),
    file("small.png", 1024),
  ]);

  assert.deepEqual(result.accepted.map((item) => item.name), ["small.png"]);
  assert.deepEqual(
    result.rejected.map((item) => [item.file.name, item.reason]),
    [["large.mov", "size"]]
  );
});

test("selectChatAttachmentFiles enforces remaining attachment slots", () => {
  const result = selectChatAttachmentFiles(
    [file("one.png", 1), file("two.png", 1), file("three.png", 1)],
    MAX_CHAT_ATTACHMENTS_PER_MESSAGE - 1
  );

  assert.deepEqual(result.accepted.map((item) => item.name), ["one.png"]);
  assert.deepEqual(
    result.rejected.map((item) => [item.file.name, item.reason]),
    [
      ["two.png", "limit"],
      ["three.png", "limit"],
    ]
  );
});

test("selectChatAttachmentFiles does not let oversized files consume open slots", () => {
  const result = selectChatAttachmentFiles(
    [
      file("large.png", MAX_CHAT_ATTACHMENT_SIZE_BYTES + 1),
      file("small.png", 1),
    ],
    MAX_CHAT_ATTACHMENTS_PER_MESSAGE - 1
  );

  assert.deepEqual(result.accepted.map((item) => item.name), ["small.png"]);
  assert.deepEqual(
    result.rejected.map((item) => [item.file.name, item.reason]),
    [["large.png", "size"]]
  );
});
