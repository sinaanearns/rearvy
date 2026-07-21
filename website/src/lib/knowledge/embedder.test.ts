import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { getEmbedding } from "./embedder";

const ENV_KEYS = [
  "NVIDIA_API_KEY",
  "NVIDIA_EMBEDDINGS_BASE_URL",
  "EMBEDDING_MODEL",
] as const;

const originalEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]])
) as Record<(typeof ENV_KEYS)[number], string | undefined>;

const originalFetch = globalThis.fetch;

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  globalThis.fetch = originalFetch;
});

test("returns a 2048-length zero vector when no API key is configured", async () => {
  delete process.env.NVIDIA_API_KEY;
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    throw new Error("fetch should not be called");
  }) as typeof fetch;

  const embedding = await getEmbedding("hello world");

  assert.equal(called, false);
  assert.equal(embedding.length, 2048);
  assert.ok(embedding.every((v) => v === 0));
});

test("posts to the configured endpoint and returns the embedding payload", async () => {
  process.env.NVIDIA_API_KEY = "test-key";
  process.env.NVIDIA_EMBEDDINGS_BASE_URL = "https://embeddings.test/v1";
  process.env.EMBEDDING_MODEL = "test-model";

  let capturedUrl: string | undefined;
  let capturedInit: RequestInit | undefined;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    capturedUrl = url;
    capturedInit = init;
    return {
      ok: true,
      status: 200,
      async json() {
        return { data: [{ embedding: [0.1, 0.2, 0.3] }] };
      },
    };
  }) as unknown as typeof fetch;

  const embedding = await getEmbedding("multi\nline\ntext");

  assert.equal(capturedUrl, "https://embeddings.test/v1/embeddings");
  assert.deepEqual(embedding, [0.1, 0.2, 0.3]);

  const headers = capturedInit?.headers as Record<string, string>;
  assert.equal(headers.Authorization, "Bearer test-key");
  const body = JSON.parse(String(capturedInit?.body));
  assert.equal(body.model, "test-model");
  assert.equal(body.input, "multi line text");
});

test("returns a 1536-length zero vector when the request fails", async () => {
  process.env.NVIDIA_API_KEY = "test-key";
  globalThis.fetch = (async () => ({
    ok: false,
    status: 500,
    async text() {
      return "server error";
    },
  })) as unknown as typeof fetch;

  const embedding = await getEmbedding("hello");

  assert.equal(embedding.length, 1536);
  assert.ok(embedding.every((v) => v === 0));
});

test("returns a zero vector when fetch rejects", async () => {
  process.env.NVIDIA_API_KEY = "test-key";
  globalThis.fetch = (async () => {
    throw new Error("network down");
  }) as typeof fetch;

  const embedding = await getEmbedding("hello");

  assert.equal(embedding.length, 1536);
});
