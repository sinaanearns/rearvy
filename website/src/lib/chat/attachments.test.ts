import assert from "node:assert/strict";
import test from "node:test";

import {
  buildChatMessagePreview,
  formatChatAttachmentPreviewBackgroundImage,
  isImageContentType,
  normalizeChatAttachmentUrl,
  normalizeChatAttachments,
  sanitizeChatAttachmentName,
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
  assert.equal(normalizeChatAttachmentUrl("/api/auth/logout"), null);
  assert.equal(normalizeChatAttachmentUrl("/chat-attachments/../secret.png"), null);
  assert.equal(normalizeChatAttachmentUrl("/chat-attachments/chat/%2e%2e/secret.png"), null);
  assert.equal(normalizeChatAttachmentUrl("/chat-attachments/chat/%2Fsecret.png"), null);
  assert.equal(normalizeChatAttachmentUrl("/chat-attachments/chat\\secret.png"), null);
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

test("isImageContentType only accepts safe raster image MIME types", () => {
  assert.equal(isImageContentType("image/png"), true);
  assert.equal(isImageContentType(" IMAGE/JPEG "), true);
  assert.equal(isImageContentType("image/webp"), true);
  assert.equal(isImageContentType("image/svg+xml"), false);
  assert.equal(isImageContentType("image/heic"), false);
  assert.equal(isImageContentType("application/octet-stream"), false);
});

test("normalizeChatAttachments downgrades unsafe image metadata to a file", () => {
  const [attachment] = normalizeChatAttachments([
    {
      ...baseAttachment,
      name: "logo.svg",
      contentType: "image/svg+xml",
      kind: "image",
      url: "/chat-attachments/chat-1/logo.svg",
    },
  ]);

  assert.equal(attachment?.kind, "file");
  assert.equal(
    buildChatMessagePreview({ attachments: [attachment] }),
    "Sent logo.svg"
  );
});

test("formatChatAttachmentPreviewBackgroundImage emits a quoted CSS url", () => {
  assert.equal(
    formatChatAttachmentPreviewBackgroundImage("/chat-attachments/chat-1/photo.png"),
    'url("/chat-attachments/chat-1/photo.png")'
  );
  assert.equal(formatChatAttachmentPreviewBackgroundImage("javascript:alert(1)"), undefined);
});

test("sanitizeChatAttachmentName removes header and path control characters", () => {
  assert.equal(
    sanitizeChatAttachmentName('..\\receipt;\r\n"paid".png'),
    "..-receipt-paid-.png"
  );
  assert.equal(sanitizeChatAttachmentName("\u0000\r\n"), "attachment");
});
