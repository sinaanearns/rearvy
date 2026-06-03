import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { getConfiguredAppOrigin, normalizeRearvyOrigin } from "./url";

const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

afterEach(() => {
  if (originalAppUrl === undefined) {
    delete process.env.NEXT_PUBLIC_APP_URL;
  } else {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  }
});

test("normalizeRearvyOrigin canonicalizes the bare production host", () => {
  assert.equal(
    normalizeRearvyOrigin("https://rearvy.com/some/path?query=1"),
    "https://www.rearvy.com"
  );
});

test("getConfiguredAppOrigin strips wrapping quotes and canonicalizes production host", () => {
  process.env.NEXT_PUBLIC_APP_URL = "'https://rearvy.com'";

  assert.equal(getConfiguredAppOrigin(), "https://www.rearvy.com");
});

test("getConfiguredAppOrigin falls back when env URL is malformed", () => {
  process.env.NEXT_PUBLIC_APP_URL = "not a url";

  assert.equal(
    getConfiguredAppOrigin("https://rearvy.com"),
    "https://www.rearvy.com"
  );
});

test("getConfiguredAppOrigin preserves configured preview hosts", () => {
  process.env.NEXT_PUBLIC_APP_URL = "https://rearvy-preview.vercel.app/some/path";

  assert.equal(getConfiguredAppOrigin(), "https://rearvy-preview.vercel.app");
});
