import assert from "node:assert/strict";
import { test } from "node:test";

import nextConfig from "../next.config";

async function getRedirectSources() {
  const redirectsFn = nextConfig.redirects;
  assert.equal(typeof redirectsFn, "function");
  if (!redirectsFn) {
    throw new Error("Expected redirects to be configured.");
  }

  const redirects = await redirectsFn();
  return new Set(redirects.map((redirect) => redirect.source));
}

test("desktop redirects block public website pages", async () => {
  const redirectSources = await getRedirectSources();
  const blockedSources = [
    "/",
    "/blog/:path*",
    "/contact/:path*",
    "/download/:path*",
    "/privacy/:path*",
    "/privacy-policy/:path*",
    "/security/:path*",
    "/terms/:path*",
    "/data-delete/:path*",
  ];

  for (const source of blockedSources) {
    assert.equal(redirectSources.has(source), true, source);
  }
});

test("desktop redirects allow app workspace pages", async () => {
  const redirectSources = await getRedirectSources();
  const allowedSources = ["/chat/:path*", "/settings/:path*", "/work/:path*", "/maria/:path*", "/api/:path*"];

  for (const source of allowedSources) {
    assert.equal(redirectSources.has(source), false, source);
  }
});
