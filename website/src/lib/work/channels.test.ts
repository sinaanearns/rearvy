import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import {
  getChannelCatalog,
  getChannelAdapter,
  hasProviderWebhookVerification,
  parseChannelCredentialsPayload,
  parseInboundWebhookPayload,
  resolveInboundChannelUserId,
  resolveWebhookVerification,
} from "./channels";

test("getChannelCatalog exposes all requested provider shells", () => {
  const providers = getChannelCatalog().map((entry) => entry.provider).sort();

  assert.deepEqual(providers, [
    "dingtalk",
    "discord",
    "lark",
    "slack",
    "telegram",
    "wechat",
    "whatsapp",
  ]);
});

test("parseInboundWebhookPayload accepts JSON objects only", () => {
  assert.deepEqual(parseInboundWebhookPayload('{"event":{"text":"hello"}}'), {
    event: { text: "hello" },
  });
  assert.equal(parseInboundWebhookPayload("not-json"), null);
  assert.equal(parseInboundWebhookPayload("[]"), null);
  assert.equal(parseInboundWebhookPayload('"text"'), null);
});

test("parseChannelCredentialsPayload keeps only string credentials", () => {
  assert.deepEqual(
    parseChannelCredentialsPayload(
      JSON.stringify({
        botToken: "xoxb-token",
        signingSecret: "secret",
        retryCount: 3,
        enabled: true,
        nested: { value: "ignored" },
      })
    ),
    {
      botToken: "xoxb-token",
      signingSecret: "secret",
    }
  );
});

test("parseChannelCredentialsPayload rejects malformed and non-object JSON", () => {
  assert.deepEqual(parseChannelCredentialsPayload("not-json"), {});
  assert.deepEqual(parseChannelCredentialsPayload("[]"), {});
  assert.deepEqual(parseChannelCredentialsPayload('"token"'), {});
});

test("resolveWebhookVerification checks Slack signatures", () => {
  const payload = JSON.stringify({ event: { text: "hello" } });
  const timestamp = "1770000000";
  const signingSecret = "secret";
  const signature = `v0=${createHmac("sha256", signingSecret)
    .update(`v0:${timestamp}:${payload}`)
    .digest("hex")}`;

  const headers = new Headers({
    "x-slack-request-timestamp": timestamp,
    "x-slack-signature": signature,
  });

  assert.equal(
    resolveWebhookVerification("slack", payload, headers, { botToken: "xoxb", signingSecret }),
    true
  );
  assert.equal(
    resolveWebhookVerification("slack", payload, headers, { botToken: "xoxb", signingSecret: "wrong" }),
    false
  );
});

test("hasProviderWebhookVerification fails closed without provider secrets", () => {
  assert.equal(hasProviderWebhookVerification("telegram", { botToken: "token" }), false);
  assert.equal(hasProviderWebhookVerification("discord", { webhookUrl: "https://example.com" }), false);
  assert.equal(hasProviderWebhookVerification("slack", { botToken: "xoxb", signingSecret: "secret" }), true);
  assert.equal(hasProviderWebhookVerification("whatsapp", { accessToken: "token", appSecret: "secret" }), true);
});

test("resolveInboundChannelUserId requires an exact external channel match", () => {
  const connections = [
    { user_id: "first-user", status: "active", external_channel_id: "channel-a" },
    { user_id: "second-user", status: "active", external_channel_id: "channel-b" },
  ];

  assert.equal(resolveInboundChannelUserId(connections, null), null);
  assert.equal(resolveInboundChannelUserId(connections, "unknown-channel"), null);
  assert.equal(resolveInboundChannelUserId(connections, "channel-b"), "second-user");
});

test("channel sends tolerate malformed provider JSON responses", async () => {
  const originalFetch = globalThis.fetch;
  const adapter = getChannelAdapter("telegram");
  const connection = {
    external_channel_id: "chat-1",
    config: {},
  };

  try {
    globalThis.fetch = (async () => new Response("not-json")) as typeof fetch;

    const result = await adapter.send(
      connection as never,
      { botToken: "token" },
      "hello"
    );

    assert.deepEqual(result, { ok: true, providerMessageId: null });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("channel send failures fall back for non-object provider responses", async () => {
  const originalFetch = globalThis.fetch;
  const adapter = getChannelAdapter("telegram");
  const connection = {
    external_channel_id: "chat-1",
    config: {},
  };

  try {
    globalThis.fetch = (async () =>
      new Response("[]", { status: 500 })) as typeof fetch;

    const result = await adapter.send(
      connection as never,
      { botToken: "token" },
      "hello"
    );

    assert.deepEqual(result, { ok: false, error: "{}" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
