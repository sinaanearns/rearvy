import assert from "node:assert/strict";
import test from "node:test";
import { getEmbedding } from "./embedder";

const savedEnvironment = {
  apiKey: process.env.NVIDIA_API_KEY,
  baseUrl: process.env.NVIDIA_EMBEDDINGS_BASE_URL,
  model: process.env.EMBEDDING_MODEL,
};

function restoreEnvironment() {
  process.env.NVIDIA_API_KEY = savedEnvironment.apiKey;
  process.env.NVIDIA_EMBEDDINGS_BASE_URL = savedEnvironment.baseUrl;
  process.env.EMBEDDING_MODEL = savedEnvironment.model;
}

test.afterEach(() => {
  restoreEnvironment();
});

test("getEmbedding sends the retrieval mode required by NVIDIA embeddings", async () => {
  process.env.NVIDIA_API_KEY = "test-key";
  process.env.NVIDIA_EMBEDDINGS_BASE_URL = "https://example.test/v1/";
  delete process.env.EMBEDDING_MODEL;

  const originalFetch = global.fetch;
  let request: RequestInit | undefined;
  global.fetch = async (_input, init) => {
    request = init;
    return new Response(JSON.stringify({ data: [{ embedding: [0.5, 1] }] }), { status: 200 });
  };

  try {
    assert.deepEqual(await getEmbedding("hello\nworld", "query"), [0.5, 1]);
    assert.deepEqual(JSON.parse(String(request?.body)), {
      input: "hello world",
      model: "nvidia/nv-embed-v1",
      input_type: "query",
      encoding_format: "float",
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test("getEmbedding returns null when NVIDIA rejects the request", async () => {
  process.env.NVIDIA_API_KEY = "test-key";
  const originalFetch = global.fetch;
  global.fetch = async () => new Response("not authorized", { status: 401 });

  try {
    assert.equal(await getEmbedding("hello", "passage"), null);
  } finally {
    global.fetch = originalFetch;
  }
});
