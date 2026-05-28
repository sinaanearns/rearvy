import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  applyImageAspectRatioToDataUrl,
  normalizeCloudflareImageGenerationResponse,
  normalizeCloudflareVideoGenerationResponse,
  submitCloudflareVideoGeneration,
} from "./cloudflare-media.ts";

test("normalizes wrapped Workers AI image output", () => {
  const result = normalizeCloudflareImageGenerationResponse(
    {
      success: true,
      result: {
        image: "a".repeat(80),
      },
    },
    "@cf/black-forest-labs/flux-1-schnell"
  );

  assert.equal(result.provider, "cloudflare");
  assert.equal(result.status, "completed");
  assert.equal(result.images.length, 1);
  assert.ok(result.images[0].startsWith("data:image/jpeg;base64,"));
});

test("normalizes AI Gateway text-to-video output", () => {
  const result = normalizeCloudflareVideoGenerationResponse(
    {
      success: true,
      result: {
        state: "Completed",
        result: {
          video: "https://example.com/output.mp4",
          task_id: "task-123",
          status: "Success",
        },
        gatewayMetadata: {
          keySource: "Unified",
        },
      },
    },
    "google/veo-3.1-fast"
  );

  assert.equal(result.provider, "cloudflare");
  assert.equal(result.status, "completed");
  assert.deepEqual(result.videos, ["https://example.com/output.mp4"]);
  assert.equal(result.taskId, "task-123");
  assert.equal(result.jobId, undefined);
});

test("crops data image output to the requested aspect ratio", async () => {
  const input = await sharp({
    create: {
      width: 80,
      height: 80,
      channels: 3,
      background: "#ffffff",
    },
  })
    .jpeg()
    .toBuffer();

  const output = await applyImageAspectRatioToDataUrl(
    `data:image/jpeg;base64,${input.toString("base64")}`,
    "4:5"
  );
  const outputBuffer = Buffer.from(output.split(",")[1] || "", "base64");
  const metadata = await sharp(outputBuffer).metadata();

  assert.equal(metadata.width, 64);
  assert.equal(metadata.height, 80);
});

test("does not expose unpollable Cloudflare video tasks as jobs", () => {
  const result = normalizeCloudflareVideoGenerationResponse(
    {
      success: true,
      result: {
        state: "queued",
        task_id: "task-queued",
      },
    },
    "google/veo-3.1-fast"
  );

  assert.equal(result.status, "pending");
  assert.equal(result.taskId, "task-queued");
  assert.equal(result.jobId, undefined);
  assert.deepEqual(result.videos, []);
});

test("runs Cloudflare partner video models through the universal endpoint", async (t) => {
  const originalFetch = globalThis.fetch;
  const envKeys = [
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_AI_API_TOKEN",
    "CLOUDFLARE_VIDEO_MODEL",
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

  process.env.CLOUDFLARE_ACCOUNT_ID = "account-123";
  process.env.CLOUDFLARE_API_TOKEN = "token-123";
  delete process.env.CLOUDFLARE_AI_API_TOKEN;
  process.env.CLOUDFLARE_VIDEO_MODEL = "bytedance/seedance-2.0";

  let requestedUrl: string | undefined;
  let requestedInit: RequestInit | undefined;

  globalThis.fetch = (async (url, init) => {
    requestedUrl = String(url);
    requestedInit = init;

    return new Response(
      JSON.stringify({
        success: true,
        result: {
          status: "success",
          video: "https://example.com/seedance.mp4",
        },
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }
    );
  }) as typeof fetch;

  const result = await submitCloudflareVideoGeneration({
    prompt: "A golden retriever running through sunflowers",
    aspectRatio: "16:9",
    resolution: "720p",
    duration: 5,
  });

  assert.equal(
    requestedUrl,
    "https://api.cloudflare.com/client/v4/accounts/account-123/ai/run"
  );
  assert.deepEqual(JSON.parse(requestedInit?.body as string), {
    model: "bytedance/seedance-2.0",
    input: {
      prompt: "A golden retriever running through sunflowers",
      aspect_ratio: "16:9",
      resolution: "720p",
      duration: 5,
    },
  });
  assert.equal(
    (requestedInit?.headers as Record<string, string>).Authorization,
    "Bearer token-123"
  );
  assert.deepEqual(result.videos, ["https://example.com/seedance.mp4"]);
});
