import assert from "node:assert/strict";
import test from "node:test";
import {
  hasNvidiaOcrConfig,
  getNvidiaOcrConfigError,
  normalizeNvidiaOcrResponse,
  submitNvidiaOcr,
} from "./nvidia-ocr.ts";

// Minimal 1x1 transparent PNG encoded in base64
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const MODEL = "nvidia/nemotron-ocr-v2";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function makeMockFetch(status: number, body: unknown) {
  const ok = status >= 200 && status < 300;
  return async (_url: string | URL | Request, _init?: RequestInit) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }) as unknown as Response & { ok: boolean };
}

// ─────────────────────────────────────────────
// hasNvidiaOcrConfig
// ─────────────────────────────────────────────

test("hasNvidiaOcrConfig returns false when no API key env vars are set", () => {
  const saved = {
    NVIDIA_OCR_API_KEY: process.env.NVIDIA_OCR_API_KEY,
    NVIDIA_API_KEY: process.env.NVIDIA_API_KEY,
  };
  delete process.env.NVIDIA_OCR_API_KEY;
  delete process.env.NVIDIA_API_KEY;

  assert.equal(hasNvidiaOcrConfig(), false);

  // restore
  process.env.NVIDIA_OCR_API_KEY = saved.NVIDIA_OCR_API_KEY;
  process.env.NVIDIA_API_KEY = saved.NVIDIA_API_KEY;
});

test("hasNvidiaOcrConfig returns true when NVIDIA_OCR_API_KEY is set", () => {
  const saved = process.env.NVIDIA_OCR_API_KEY;
  process.env.NVIDIA_OCR_API_KEY = "nvapi-test";

  assert.equal(hasNvidiaOcrConfig(), true);

  process.env.NVIDIA_OCR_API_KEY = saved;
});

test("hasNvidiaOcrConfig returns true when only NVIDIA_API_KEY is set", () => {
  const savedOcr = process.env.NVIDIA_OCR_API_KEY;
  const savedApi = process.env.NVIDIA_API_KEY;
  delete process.env.NVIDIA_OCR_API_KEY;
  process.env.NVIDIA_API_KEY = "nvapi-fallback";

  assert.equal(hasNvidiaOcrConfig(), true);

  process.env.NVIDIA_OCR_API_KEY = savedOcr;
  process.env.NVIDIA_API_KEY = savedApi;
});

// ─────────────────────────────────────────────
// getNvidiaOcrConfigError
// ─────────────────────────────────────────────

test("getNvidiaOcrConfigError returns a non-empty string mentioning the key name", () => {
  const error = getNvidiaOcrConfigError();
  assert.equal(typeof error, "string");
  assert.ok(error.length > 10);
  assert.ok(error.includes("NVIDIA_OCR_API_KEY"));
});

// ─────────────────────────────────────────────
// normalizeNvidiaOcrResponse
// ─────────────────────────────────────────────

test("normalizeNvidiaOcrResponse handles a flat text-only response", () => {
  const raw = { text: "Hello World" };
  const result = normalizeNvidiaOcrResponse(raw, MODEL);
  assert.equal(result.provider, "nvidia");
  assert.equal(result.model, MODEL);
  assert.equal(result.text, "Hello World");
  assert.equal(result.pages.length, 1);
  assert.equal(result.pages[0].pageIndex, 0);
  assert.equal(result.words.length, 0);
  assert.equal(result.averageConfidence, 1.0);
});

test("normalizeNvidiaOcrResponse handles a response with words and bboxes", () => {
  const raw = {
    text: "Invoice Total",
    words: [
      { text: "Invoice", bbox: [0.1, 0.2, 0.3, 0.05], confidence: 0.98 },
      { text: "Total", bbox: [0.4, 0.2, 0.2, 0.05], confidence: 0.95 },
    ],
  };
  const result = normalizeNvidiaOcrResponse(raw, MODEL);
  assert.equal(result.text, "Invoice Total");
  assert.equal(result.words.length, 2);
  assert.equal(result.words[0].text, "Invoice");
  assert.deepEqual(result.words[0].bbox, [0.1, 0.2, 0.3, 0.05]);
  assert.equal(result.words[0].confidence, 0.98);
  const expectedAvg = (0.98 + 0.95) / 2;
  assert.ok(Math.abs(result.averageConfidence - expectedAvg) < 0.001);
});

test("normalizeNvidiaOcrResponse handles a multi-page (results array) response", () => {
  const raw = {
    results: [
      {
        text: "Page one",
        words: [
          { text: "Page", confidence: 1.0 },
          { text: "one", confidence: 1.0 },
        ],
      },
      {
        text: "Page two",
        words: [
          { text: "Page", confidence: 0.9 },
          { text: "two", confidence: 0.9 },
        ],
      },
    ],
  };
  const result = normalizeNvidiaOcrResponse(raw, MODEL);
  assert.equal(result.pages.length, 2);
  assert.equal(result.pages[0].text, "Page one");
  assert.equal(result.pages[1].text, "Page two");
  assert.ok(result.text.includes("Page one"));
  assert.ok(result.text.includes("Page two"));
  assert.equal(result.words.length, 4);
});

test("normalizeNvidiaOcrResponse handles an empty response gracefully", () => {
  const raw = {};
  const result = normalizeNvidiaOcrResponse(raw, MODEL);
  assert.equal(result.text, "");
  assert.equal(result.pages.length, 0);
  assert.equal(result.words.length, 0);
  assert.equal(result.averageConfidence, 1.0);
});

test("normalizeNvidiaOcrResponse handles null gracefully", () => {
  const result = normalizeNvidiaOcrResponse(null, MODEL);
  assert.equal(result.text, "");
});

test("normalizeNvidiaOcrResponse handles undefined gracefully", () => {
  const result = normalizeNvidiaOcrResponse(undefined, MODEL);
  assert.equal(result.text, "");
});

test("normalizeNvidiaOcrResponse normalizes words with missing bbox to null", () => {
  const raw = {
    words: [{ text: "noBbox", confidence: 0.75 }],
  };
  const result = normalizeNvidiaOcrResponse(raw, MODEL);
  assert.equal(result.words[0].bbox, null);
  assert.equal(result.words[0].confidence, 0.75);
});

test("normalizeNvidiaOcrResponse preserves the raw response", () => {
  const raw = { text: "test", custom_field: "kept" };
  const result = normalizeNvidiaOcrResponse(raw, MODEL);
  assert.equal(result.raw, raw);
});

// ─────────────────────────────────────────────
// submitNvidiaOcr
// ─────────────────────────────────────────────

test("submitNvidiaOcr returns normalized result on success", async (t) => {
  const originalFetch = globalThis.fetch;
  const savedKey = process.env.NVIDIA_OCR_API_KEY;
  const savedUrl = process.env.NVIDIA_OCR_INFER_URL;

  t.after(() => {
    globalThis.fetch = originalFetch;
    process.env.NVIDIA_OCR_API_KEY = savedKey;
    process.env.NVIDIA_OCR_INFER_URL = savedUrl;
  });

  process.env.NVIDIA_OCR_API_KEY = "nvapi-test-key";
  process.env.NVIDIA_OCR_INFER_URL = "https://integrate.api.nvidia.com/v1/infer";

  globalThis.fetch = makeMockFetch(200, {
    text: "Receipt: $42.00",
    words: [
      { text: "Receipt:", confidence: 0.99 },
      { text: "$42.00", confidence: 0.97 },
    ],
  });

  const result = await submitNvidiaOcr({
    imageBase64: TINY_PNG_BASE64,
    mimeType: "image/png",
  });

  assert.equal(result.provider, "nvidia");
  assert.equal(result.model, "nvidia/nemotron-ocr-v2");
  assert.equal(result.text, "Receipt: $42.00");
  assert.equal(result.words.length, 2);
  const expectedAvg = (0.99 + 0.97) / 2;
  assert.ok(Math.abs(result.averageConfidence - expectedAvg) < 0.001);
});

test("submitNvidiaOcr throws an error on 4xx responses", async (t) => {
  const originalFetch = globalThis.fetch;
  const savedKey = process.env.NVIDIA_OCR_API_KEY;

  t.after(() => {
    globalThis.fetch = originalFetch;
    process.env.NVIDIA_OCR_API_KEY = savedKey;
  });

  process.env.NVIDIA_OCR_API_KEY = "nvapi-test-key";

  globalThis.fetch = makeMockFetch(400, { detail: "Bad image format" });

  await assert.rejects(() => submitNvidiaOcr({ imageBase64: TINY_PNG_BASE64 }));
});

test("submitNvidiaOcr throws an error on 5xx responses", async (t) => {
  const originalFetch = globalThis.fetch;
  const savedKey = process.env.NVIDIA_OCR_API_KEY;

  t.after(() => {
    globalThis.fetch = originalFetch;
    process.env.NVIDIA_OCR_API_KEY = savedKey;
  });

  process.env.NVIDIA_OCR_API_KEY = "nvapi-test-key";

  globalThis.fetch = makeMockFetch(500, { error: "Internal server error" });

  await assert.rejects(() => submitNvidiaOcr({ imageBase64: TINY_PNG_BASE64 }));
});

test("submitNvidiaOcr throws when no text or words are returned", async (t) => {
  const originalFetch = globalThis.fetch;
  const savedKey = process.env.NVIDIA_OCR_API_KEY;

  t.after(() => {
    globalThis.fetch = originalFetch;
    process.env.NVIDIA_OCR_API_KEY = savedKey;
  });

  process.env.NVIDIA_OCR_API_KEY = "nvapi-test-key";

  globalThis.fetch = makeMockFetch(200, {});

  await assert.rejects(
    () => submitNvidiaOcr({ imageBase64: TINY_PNG_BASE64 }),
    /did not return any recognized text/
  );
});
