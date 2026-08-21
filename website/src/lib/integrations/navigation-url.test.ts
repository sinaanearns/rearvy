import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeIntegrationNavigationUrl,
  requireIntegrationNavigationUrl,
} from "./navigation-url";

test("normalizeIntegrationNavigationUrl accepts only http and https URLs", () => {
  assert.equal(
    normalizeIntegrationNavigationUrl(" https://accounts.google.com/o/oauth2/v2/auth "),
    "https://accounts.google.com/o/oauth2/v2/auth"
  );
  assert.equal(normalizeIntegrationNavigationUrl("http://localhost:3000/callback"), "http://localhost:3000/callback");
  assert.equal(normalizeIntegrationNavigationUrl("javascript:alert(1)"), null);
  assert.equal(normalizeIntegrationNavigationUrl("/api/integrations/gmail/connect"), null);
  assert.equal(normalizeIntegrationNavigationUrl(null), null);
});

test("requireIntegrationNavigationUrl rejects unsafe navigation values", () => {
  assert.throws(
    () => requireIntegrationNavigationUrl("javascript:alert(1)"),
    /Invalid authorization URL/
  );
});
