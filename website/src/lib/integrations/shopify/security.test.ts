import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  normalizeShopifyDomain,
  parseShopifyWebhookPayload,
  verifyShopifyWebhookHmac,
} from "./security";

test("normalizeShopifyDomain accepts canonical Shopify hosts only", () => {
  assert.equal(
    normalizeShopifyDomain("https://Example-Store.myshopify.com/admin"),
    "example-store.myshopify.com"
  );
  assert.equal(normalizeShopifyDomain("example-store"), "example-store.myshopify.com");
  assert.equal(normalizeShopifyDomain("-bad-store"), null);
  assert.equal(normalizeShopifyDomain("example.com"), null);
});

test("verifyShopifyWebhookHmac checks Shopify webhook signatures", () => {
  const body = JSON.stringify({ id: 123, topic: "orders/create" });
  const secret = "webhook-secret";
  const hmac = createHmac("sha256", secret).update(body, "utf8").digest("base64");

  assert.equal(verifyShopifyWebhookHmac(body, hmac, secret), true);
  assert.equal(verifyShopifyWebhookHmac(body, hmac, "wrong-secret"), false);
  assert.equal(verifyShopifyWebhookHmac(body, "", secret), false);
});

test("parseShopifyWebhookPayload accepts JSON objects only", () => {
  assert.deepEqual(parseShopifyWebhookPayload('{"id":123,"name":"#1001"}'), {
    id: 123,
    name: "#1001",
  });
  assert.equal(parseShopifyWebhookPayload("not-json"), null);
  assert.equal(parseShopifyWebhookPayload("[]"), null);
  assert.equal(parseShopifyWebhookPayload('"text"'), null);
});
