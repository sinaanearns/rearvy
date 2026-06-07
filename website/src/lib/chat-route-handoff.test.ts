import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mergeChatRouteMessages,
  parseStoredChatRouteHandoff,
} from "./chat-route-handoff";

const NOW = 1_000_000;

function textMessage(id: string, content: string) {
  return {
    id,
    role: "user" as const,
    content,
    parts: [{ type: "text" as const, text: content }],
  };
}

describe("parseStoredChatRouteHandoff", () => {
  it("parses valid handoffs and filters malformed messages", () => {
    const validMessage = textMessage("message-1", "open google");
    const handoff = parseStoredChatRouteHandoff(
      JSON.stringify({
        chatId: "chat-1",
        projectId: "project-1",
        messages: [
          validMessage,
          { id: "missing-parts", role: "user", content: "ignored" },
          { id: "bad-role", role: "system", content: "ignored", parts: [] },
        ],
        createdAt: NOW,
      }),
      NOW + 10
    );

    assert.deepEqual(handoff, {
      chatId: "chat-1",
      projectId: "project-1",
      messages: [validMessage],
      createdAt: NOW,
    });
  });

  it("normalizes missing project ids to null", () => {
    const handoff = parseStoredChatRouteHandoff(
      JSON.stringify({
        chatId: "chat-1",
        messages: [],
        createdAt: NOW,
      }),
      NOW
    );

    assert.equal(handoff?.projectId, null);
  });

  it("rejects invalid or expired stored values", () => {
    assert.equal(parseStoredChatRouteHandoff(null, NOW), null);
    assert.equal(parseStoredChatRouteHandoff("not-json", NOW), null);
    assert.equal(parseStoredChatRouteHandoff("[]", NOW), null);
    assert.equal(
      parseStoredChatRouteHandoff(
        JSON.stringify({ chatId: "chat-1", messages: [], createdAt: NOW - 120_001 }),
        NOW
      ),
      null
    );
    assert.equal(
      parseStoredChatRouteHandoff(
        JSON.stringify({
          chatId: "chat-1",
          projectId: 123,
          messages: [],
          createdAt: NOW,
        }),
        NOW
      ),
      null
    );
  });
});

describe("mergeChatRouteMessages", () => {
  it("deduplicates by message id and normalized content signature", () => {
    const persisted = [textMessage("message-1", "btc/usd")];
    const duplicateId = textMessage("message-1", "different text");
    const duplicateSignature = textMessage("message-2", "btc/usd");
    const newMessage = textMessage("message-3", "open google");

    assert.deepEqual(
      mergeChatRouteMessages(persisted, [
        duplicateId,
        duplicateSignature,
        newMessage,
      ]),
      [...persisted, newMessage]
    );
  });
});
