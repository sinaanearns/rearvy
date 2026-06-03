import assert from "node:assert/strict";
import test from "node:test";
import {
  isNvidiaCosmosVideoModel,
  submitNvidiaCosmosVideoGeneration,
} from "./nvidia-cosmos-video.ts";

test("detects NVIDIA Cosmos video model ids", () => {
  assert.equal(isNvidiaCosmosVideoModel("nvidia/cosmos-predict1-7b"), true);
  assert.equal(isNvidiaCosmosVideoModel("google/veo-3.1-fast"), false);
});

test("submits Cosmos video prompts to the configured NIM infer endpoint", async (t) => {
  const originalFetch = globalThis.fetch;
  const envKeys = [
    "NVIDIA_COSMOS_BASE_URL",
    "NVIDIA_COSMOS_INFER_URL",
    "NVIDIA_COSMOS_API_KEY",
    "NVIDIA_COSMOS_VIDEO_MODEL",
    "NVIDIA_API_KEY",
  ];
  const originalEnv = Object.fromEntries(
    envKeys.map((key) => [key, process.env[key]])
  );

  t.after(() => {
    globalThis.fetch = originalFetch;
    for (const key of envKeys) {
      const value = originalEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  process.env.NVIDIA_COSMOS_BASE_URL = "http://127.0.0.1:8000/v1";
  process.env.NVIDIA_COSMOS_API_KEY = "test-key";
  process.env.NVIDIA_COSMOS_VIDEO_MODEL = "nvidia/cosmos-predict1-7b";
  delete process.env.NVIDIA_COSMOS_INFER_URL;
  delete process.env.NVIDIA_API_KEY;

  let requestedUrl: string | undefined;
  let requestedInit: RequestInit | undefined;

  globalThis.fetch = (async (url, init) => {
    requestedUrl = String(url);
    requestedInit = init;

    return new Response(
      JSON.stringify({
        video: "a".repeat(80),
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );
  }) as typeof fetch;

  const result = await submitNvidiaCosmosVideoGeneration({
    prompt: "A camera moves through a rainy street",
    seed: 4,
  });

  assert.equal(requestedUrl, "http://127.0.0.1:8000/v1/infer");
  assert.deepEqual(JSON.parse(requestedInit?.body as string), {
    prompt: "A camera moves through a rainy street",
    seed: 4,
  });
  assert.equal(
    (requestedInit?.headers as Record<string, string>).Authorization,
    "Bearer test-key"
  );
  assert.deepEqual(result.videos, [
    `data:video/mp4;base64,${"a".repeat(80)}`,
  ]);
});
