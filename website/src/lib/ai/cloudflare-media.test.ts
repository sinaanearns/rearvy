import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeCloudflareImageGenerationResponse,
  normalizeCloudflareVideoGenerationResponse,
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
