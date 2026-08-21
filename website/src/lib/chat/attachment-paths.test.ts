import assert from "node:assert/strict";
import test from "node:test";

import {
  buildChatAttachmentStoragePath,
  sanitizeChatAttachmentPathSegment,
} from "./attachment-paths";

test("sanitizeChatAttachmentPathSegment keeps normal ids stable", () => {
  assert.equal(
    sanitizeChatAttachmentPathSegment("chat_abC-123", "chat"),
    "chat_abC-123"
  );
});

test("sanitizeChatAttachmentPathSegment removes traversal and separators", () => {
  assert.equal(
    sanitizeChatAttachmentPathSegment("../chat\\nested/../../evil", "chat"),
    "chat-nested-evil"
  );
  assert.equal(sanitizeChatAttachmentPathSegment("\u0000\r\n", "chat"), "chat");
});

test("buildChatAttachmentStoragePath creates safe attachment object names", () => {
  assert.equal(
    buildChatAttachmentStoragePath({
      chatId: "../chat\\room",
      id: "id/with\\slashes",
      fileName: 'report;\r\n"final".png',
      timestamp: 1234.9,
    }),
    "chat-attachments/chat-room/1234-id-with-slashes-report-final-.png"
  );
});
