import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import sitemap from "./sitemap";

const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

afterEach(() => {
  if (originalAppUrl === undefined) {
    delete process.env.NEXT_PUBLIC_APP_URL;
  } else {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  }
});

test("sitemap includes public marketing and policy routes", () => {
  const urls = new Set(sitemap().map((entry) => new URL(entry.url).pathname));

  for (const pathname of [
    "/",
    "/download",
    "/blog",
    "/contact",
    "/privacy-policy",
    "/security",
    "/report-issue",
    "/terms",
  ]) {
    assert.equal(urls.has(pathname), true, pathname);
  }
});

test("sitemap excludes account and app-only routes", () => {
  const urls = new Set(sitemap().map((entry) => new URL(entry.url).pathname));

  for (const pathname of [
    "/login",
    "/signup",
    "/chat",
    "/work",
    "/settings",
    "/data-delete",
  ]) {
    assert.equal(urls.has(pathname), false, pathname);
  }
});

test("sitemap uses the canonical www production host", () => {
  process.env.NEXT_PUBLIC_APP_URL = "https://rearvy.com";

  const hosts = new Set(sitemap().map((entry) => new URL(entry.url).host));

  assert.deepEqual([...hosts], ["www.rearvy.com"]);
});
