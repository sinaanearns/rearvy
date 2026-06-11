import assert from "node:assert/strict";
import test from "node:test";

import {
  formatChatAttachmentPreviewBackgroundImage,
  normalizeChatAttachmentUrl,
  normalizeChatAttachments,
} from "./attachments";

const baseAttachment = {
  id: "attachment-1",
  name: "photo.png",
  contentType: "image/png",
  size: 1024,
  storagePath: "chat-attachments/chat-1/photo.png",
};

test("normalizeChatAttachmentUrl accepts http, https, and root-relative URLs", () => {
  assert.equal(
    normalizeChatAttachmentUrl("https://firebasestorage.googleapis.com/v0/b/app/o/file.png?alt=media"),
    "https://firebasestorage.googleapis.com/v0/b/app/o/file.png?alt=media"
  );
  assert.equal(normalizeChatAttachmentUrl("http://localhost:3000/file.png"), "http://localhost:3000/file.png");
  assert.equal(normalizeChatAttachmentUrl("/chat-attachments/chat-1/photo.png"), "/chat-attachments/chat-1/photo.png");
});

test("normalizeChatAttachmentUrl rejects unsafe or ambiguous URLs", () => {
  assert.equal(normalizeChatAttachmentUrl("javascript:alert(1)"), null);
  assert.equal(normalizeChatAttachmentUrl("data:image/png;base64,abc"), null);
  assert.equal(normalizeChatAttachmentUrl("//evil.test/photo.png"), null);
  assert.equal(normalizeChatAttachmentUrl("chat-attachments/photo.png"), null);
  assert.equal(normalizeChatAttachmentUrl(""), null);
});

test("normalizeChatAttachments drops attachments with unsafe URLs", () => {
  assert.deepEqual(
    normalizeChatAttachments([
      { ...baseAttachment, url: "/chat-attachments/chat-1/photo.png" },
      { ...baseAttachment, id: "bad-attachment", url: "javascript:alert(1)" },
    ]).map((attachment) => attachment.id),
    ["attachment-1"]
  );
});

test("formatChatAttachmentPreviewBackgroundImage emits a quoted CSS url", () => {
  assert.equal(
    formatChatAttachmentPreviewBackgroundImage("/chat-attachments/chat-1/photo.png"),
    'url("/chat-attachments/chat-1/photo.png")'
  );
  assert.equal(formatChatAttachmentPreviewBackgroundImage("javascript:alert(1)"), undefined);
});
