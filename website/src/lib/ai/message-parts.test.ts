import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStoredUserMessageParts,
  buildUserMessageSummary,
  extractIncomingMessageImageSources,
  messageHasImageParts,
  normalizeIncomingMessagesForModel,
} from "./message-parts";

test("message image helpers ignore unsafe image media types", () => {
  const message = {
    parts: [
      {
        type: "file",
        mediaType: "image/svg+xml",
        url: "data:image/svg+xml;base64,PHN2Zz4=",
      },
      {
        type: "file",
        mediaType: "image/png",
        url: "data:image/png;base64,abcd",
      },
    ],
  };

  assert.equal(messageHasImageParts(message), true);
  assert.deepEqual(extractIncomingMessageImageSources(message), [
    "data:image/png;base64,abcd",
  ]);
  assert.equal(buildUserMessageSummary(message), "Uploaded 1 image and 1 file");
});

test("legacy image parts require safe image media types", () => {
  const unsafeMessage = {
    parts: [
      {
        type: "image",
        mediaType: "image/svg+xml",
        image: "data:image/svg+xml;base64,PHN2Zz4=",
      },
    ],
  };
  const safeMessage = {
    parts: [
      {
        type: "image",
        image: "https://example.com/image.png",
      },
    ],
  };

  assert.equal(messageHasImageParts(unsafeMessage), false);
  assert.deepEqual(buildStoredUserMessageParts(unsafeMessage), null);
  assert.equal(messageHasImageParts(safeMessage), true);
  assert.deepEqual(buildStoredUserMessageParts(safeMessage), [
    {
      type: "file",
      mediaType: "image/png",
      url: "https://example.com/image.png",
    },
  ]);
});

test("normalizeIncomingMessagesForModel downgrades unsafe image media types", () => {
  const [message] = normalizeIncomingMessagesForModel([
    {
      role: "user",
      parts: [
        {
          type: "file",
          mediaType: "image/svg+xml",
          url: "data:image/svg+xml;base64,PHN2Zz4=",
        },
        {
          type: "file",
          mediaType: "image/png",
          url: "data:image/png;base64,abcd",
        },
      ],
    },
  ]) as Array<{ parts: Array<Record<string, unknown>> }>;

  assert.deepEqual(message.parts, [
    {
      type: "text",
      text: "<image>",
    },
    {
      type: "file",
      mediaType: "application/octet-stream",
      url: "PHN2Zz4=",
    },
    {
      type: "file",
      mediaType: "image/png",
      url: "abcd",
    },
  ]);
});
