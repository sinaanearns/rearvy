import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import {
  DEFAULT_META_TOKEN_EXPIRES_IN_SECONDS,
  ensureFreshToken,
  exchangeForLongLivedToken,
  metaFetch,
  refreshLongLivedToken,
  type MetaPlatformLabels,
} from "./meta-oauth";

const FACEBOOK_LABELS: MetaPlatformLabels = {
  apiLabel: "Facebook",
  exchangeFailure: "Facebook long-lived token exchange failed",
  exchangeMissingToken:
    "Facebook long-lived token exchange response did not include an access token",
  refreshFailure: "Facebook token refresh failed",
  refreshMissingToken:
    "Facebook token refresh response did not include an access token",
};

const INSTAGRAM_LABELS: MetaPlatformLabels = {
  apiLabel: "Instagram",
  exchangeFailure: "Long-lived token exchange failed",
  exchangeMissingToken:
    "Long-lived token exchange response did not include an access token",
  refreshFailure: "Token refresh failed",
  refreshMissingToken: "Token refresh response did not include an access token",
};

const originalFetch = globalThis.fetch;
const originalAppId = process.env.META_APP_ID;
const originalAppSecret = process.env.META_APP_SECRET;

function stubFetch(handler: (url: string) => Response | Promise<Response>) {
  globalThis.fetch = (async (input: unknown) =>
    handler(String(input))) as typeof globalThis.fetch;
}

beforeEach(() => {
  process.env.META_APP_ID = "app-id";
  process.env.META_APP_SECRET = "app-secret";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env.META_APP_ID = originalAppId;
  process.env.META_APP_SECRET = originalAppSecret;
});

test("exchangeForLongLivedToken parses a successful token response", async () => {
  stubFetch(() =>
    Response.json({ access_token: "long-lived", expires_in: 1000 })
  );

  const result = await exchangeForLongLivedToken("short", FACEBOOK_LABELS);
  assert.deepEqual(result, { accessToken: "long-lived", expiresIn: 1000 });
});

test("token response without expires_in falls back to the default", async () => {
  stubFetch(() => Response.json({ access_token: "long-lived" }));

  const result = await refreshLongLivedToken("current", INSTAGRAM_LABELS);
  assert.equal(result.expiresIn, DEFAULT_META_TOKEN_EXPIRES_IN_SECONDS);
});

test("missing OAuth credentials throw", async () => {
  delete process.env.META_APP_ID;
  await assert.rejects(
    () => exchangeForLongLivedToken("short", FACEBOOK_LABELS),
    /Missing Meta OAuth credentials/
  );
});

test("HTTP failures include the platform-specific token prefix", async () => {
  stubFetch(() => new Response("boom", { status: 400 }));

  await assert.rejects(
    () => exchangeForLongLivedToken("short", FACEBOOK_LABELS),
    /^Error: Facebook long-lived token exchange failed \(400\): boom$/
  );
  await assert.rejects(
    () => exchangeForLongLivedToken("short", INSTAGRAM_LABELS),
    /^Error: Long-lived token exchange failed \(400\): boom$/
  );
});

test("a valid token payload without an access_token surfaces the error field", async () => {
  stubFetch(() => Response.json({ error: "bad token" }));

  await assert.rejects(
    () => refreshLongLivedToken("current", FACEBOOK_LABELS),
    /bad token/
  );
});

test("metaFetch labels API errors per platform", async () => {
  stubFetch(() => new Response("nope", { status: 500 }));

  const config = {
    accessToken: "token",
    tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
  };

  await assert.rejects(
    () => metaFetch(config, "https://graph.facebook.com/v21.0/me", INSTAGRAM_LABELS),
    /Instagram API error \(500\): nope/
  );
});

test("ensureFreshToken refreshes tokens near expiry and mutates the config", async () => {
  stubFetch(() =>
    Response.json({ access_token: "refreshed", expires_in: 5000 })
  );

  const config = {
    accessToken: "stale",
    tokenExpiresAt: new Date(Date.now() + 1000),
  };

  const token = await ensureFreshToken(config, FACEBOOK_LABELS);
  assert.equal(token, "refreshed");
  assert.equal(config.accessToken, "refreshed");
  assert.ok(config.tokenExpiresAt.getTime() > Date.now() + 4000 * 1000);
});

test("ensureFreshToken keeps a token that is comfortably valid", async () => {
  stubFetch(() => {
    throw new Error("should not refresh");
  });

  const config = {
    accessToken: "valid",
    tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
  };

  const token = await ensureFreshToken(config, FACEBOOK_LABELS);
  assert.equal(token, "valid");
  assert.equal(config.accessToken, "valid");
});
