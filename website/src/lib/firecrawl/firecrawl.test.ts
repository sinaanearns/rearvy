import assert from "node:assert/strict";
import test, { describe } from "node:test";
import {
  getFirecrawlBaseUrl,
  getFirecrawlApiKey,
  isFirecrawlConfigured,
} from "./client";
import { createFirecrawlSession } from "./firecrawlSessionManager";

describe("Firecrawl Client Config", () => {
  test("getFirecrawlBaseUrl returns default URL when env is unset", () => {
    const originalUrl = process.env.FIRECRAWL_API_URL;
    delete process.env.FIRECRAWL_API_URL;
    assert.equal(getFirecrawlBaseUrl(), "https://api.firecrawl.dev");
    if (originalUrl) process.env.FIRECRAWL_API_URL = originalUrl;
  });

  test("getFirecrawlBaseUrl returns custom URL when env is set", () => {
    const originalUrl = process.env.FIRECRAWL_API_URL;
    process.env.FIRECRAWL_API_URL = "https://custom-firecrawl.example.com/";
    assert.equal(getFirecrawlBaseUrl(), "https://custom-firecrawl.example.com");
    if (originalUrl) process.env.FIRECRAWL_API_URL = originalUrl;
    else delete process.env.FIRECRAWL_API_URL;
  });

  test("isFirecrawlConfigured checks key or custom URL presence", () => {
    const originalKey = process.env.FIRECRAWL_API_KEY;
    const originalUrl = process.env.FIRECRAWL_API_URL;
    delete process.env.FIRECRAWL_API_KEY;
    delete process.env.FIRECRAWL_API_URL;

    assert.equal(isFirecrawlConfigured(), false);

    process.env.FIRECRAWL_API_KEY = "test_key_123";
    assert.equal(isFirecrawlConfigured(), true);
    assert.equal(getFirecrawlApiKey(), "test_key_123");

    if (originalKey) process.env.FIRECRAWL_API_KEY = originalKey;
    else delete process.env.FIRECRAWL_API_KEY;

    if (originalUrl) process.env.FIRECRAWL_API_URL = originalUrl;
    else delete process.env.FIRECRAWL_API_URL;
  });
});

describe("Firecrawl Session Manager Adapter", () => {
  test("returns structured error when Firecrawl is unconfigured", async () => {
    const originalKey = process.env.FIRECRAWL_API_KEY;
    const originalUrl = process.env.FIRECRAWL_API_URL;
    delete process.env.FIRECRAWL_API_KEY;
    delete process.env.FIRECRAWL_API_URL;

    const result = await createFirecrawlSession("Scrape https://example.com", "user_123");
    assert.equal(result.ok, false);
    assert.equal(result.connectionMethod, "firecrawl");
    assert.ok(result.error?.includes("Firecrawl is not configured"));

    if (originalKey) process.env.FIRECRAWL_API_KEY = originalKey;
    if (originalUrl) process.env.FIRECRAWL_API_URL = originalUrl;
  });
});
