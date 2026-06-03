import assert from "node:assert/strict";
import test from "node:test";
import {
  getImageSizeForAspectRatio,
  getMediaProviderPreference,
  getOpenAICompatibleMediaConfigError,
  getOpenAICompatibleMediaRuntimeError,
  normalizeGeneratedMediaUrls,
  resolveOpenAICompatibleMediaProvider,
} from "./media-provider.ts";

const ENV_KEYS = [
  "MEDIA_IMAGE_PROVIDER",
  "MEDIA_IMAGE_EDIT_PROVIDER",
  "MEDIA_PROVIDER",
  "NVIDIA_API_KEY",
  "NVIDIA_IMAGE_API_KEY",
  "NVIDIA_IMAGE_BASE_URL",
  "NVIDIA_IMAGE_MODEL",
  "NVIDIA_IMAGE_EDIT_MODEL",
] as const;

function withEnv(
  env: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>,
  run: () => void
) {
  const original = Object.fromEntries(
    ENV_KEYS.map((key) => [key, process.env[key]])
  );

  try {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }

    for (const [key, value] of Object.entries(env)) {
      if (value !== undefined) {
        process.env[key] = value;
      }
    }

    run();
  } finally {
    for (const key of ENV_KEYS) {
      const value = original[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("uses NVIDIA image provider when selected", () => {
  withEnv(
    {
      MEDIA_IMAGE_PROVIDER: "nvidia",
      NVIDIA_API_KEY: "test-key",
      NVIDIA_IMAGE_BASE_URL: "http://localhost:8000/v1",
      NVIDIA_IMAGE_MODEL: "qwen-image-2512",
    },
    () => {
      const provider = resolveOpenAICompatibleMediaProvider("image");

      assert.equal(getMediaProviderPreference("image"), "nvidia");
      assert.equal(provider?.name, "nvidia");
      assert.equal(provider?.baseURL, "http://localhost:8000/v1");
      assert.equal(provider?.model, "qwen-image-2512");
    }
  );
});

test("uses the image-specific NVIDIA key before the shared NVIDIA key", () => {
  withEnv(
    {
      MEDIA_IMAGE_PROVIDER: "nvidia",
      NVIDIA_API_KEY: "shared-key",
      NVIDIA_IMAGE_API_KEY: "image-key",
      NVIDIA_IMAGE_BASE_URL: "http://localhost:8000/v1",
      NVIDIA_IMAGE_MODEL: "qwen-image-2512",
    },
    () => {
      const provider = resolveOpenAICompatibleMediaProvider("image");

      assert.equal(provider?.apiKey, "image-key");
    }
  );
});

test("auto image provider resolves to NVIDIA when image NIM is configured", () => {
  withEnv(
    {
      MEDIA_IMAGE_PROVIDER: "auto",
      NVIDIA_IMAGE_BASE_URL: "http://localhost:8000/v1",
      NVIDIA_IMAGE_MODEL: "qwen-image-2512",
    },
    () => {
      const provider = resolveOpenAICompatibleMediaProvider("image");

      assert.equal(getMediaProviderPreference("image"), "auto");
      assert.equal(provider?.name, "nvidia");
      assert.equal(provider?.baseURL, "http://localhost:8000/v1");
      assert.equal(provider?.model, "qwen-image-2512");
    }
  );
});

test("ignores unsupported image provider preferences", () => {
  withEnv({ MEDIA_IMAGE_PROVIDER: "unsupported" }, () => {
    assert.equal(getMediaProviderPreference("image"), "auto");
  });

  withEnv({ MEDIA_IMAGE_PROVIDER: "local" }, () => {
    assert.equal(getMediaProviderPreference("image"), "auto");
  });
});

test("requires a deployed NVIDIA image NIM URL for Qwen image generation", () => {
  withEnv(
    {
      MEDIA_IMAGE_PROVIDER: "nvidia",
      NVIDIA_API_KEY: "test-key",
      NVIDIA_IMAGE_MODEL: "qwen-image-2512",
    },
    () => {
      assert.equal(resolveOpenAICompatibleMediaProvider("image"), null);
      assert.match(
        getOpenAICompatibleMediaConfigError("image"),
        /NVIDIA_IMAGE_BASE_URL/
      );
    }
  );
});

test("routes image edits to NVIDIA", () => {
  withEnv(
    {
      MEDIA_IMAGE_PROVIDER: "auto",
      NVIDIA_API_KEY: "test-key",
      NVIDIA_IMAGE_BASE_URL: "http://localhost:8000/v1",
      NVIDIA_IMAGE_EDIT_MODEL: "qwen-image-edit-2511",
    },
    () => {
      const provider = resolveOpenAICompatibleMediaProvider("image-edit");

      assert.equal(provider?.name, "nvidia");
      assert.equal(provider?.model, "qwen-image-edit-2511");
    }
  );
});

test("normalizes NVIDIA build-page Qwen model prefixes to API model names", () => {
  withEnv(
    {
      MEDIA_IMAGE_PROVIDER: "nvidia",
      NVIDIA_IMAGE_BASE_URL: "http://localhost:8000/v1",
      NVIDIA_IMAGE_MODEL: "qwen/qwen-image-2512",
    },
    () => {
      const provider = resolveOpenAICompatibleMediaProvider("image");

      assert.equal(provider?.model, "qwen-image-2512");
    }
  );
});

test("rejects non-Qwen NVIDIA image generation models", () => {
  withEnv(
    {
      MEDIA_IMAGE_PROVIDER: "nvidia",
      NVIDIA_IMAGE_BASE_URL: "http://localhost:8000/v1",
      NVIDIA_IMAGE_MODEL: "flux.2-klein-4b",
    },
    () => {
      assert.equal(resolveOpenAICompatibleMediaProvider("image"), null);
      assert.match(
        getOpenAICompatibleMediaConfigError("image"),
        /qwen-image-2512/
      );
    }
  );
});

test("maps NVIDIA 404s to a NIM deployment hint", () => {
  const message = getOpenAICompatibleMediaRuntimeError(
    new Error("Not Found"),
    "nvidia",
    "image"
  );

  assert.match(message, /downloadable Visual GenAI NIM/);
  assert.match(message, /NVIDIA_IMAGE_BASE_URL/);
});

test("maps aspect ratios to OpenAI-compatible image sizes", () => {
  assert.equal(getImageSizeForAspectRatio("16:9"), "1280x720");
  assert.equal(getImageSizeForAspectRatio("9:16"), "720x1280");
  assert.equal(getImageSizeForAspectRatio("1:1", "512x512"), "512x512");
});

test("normalizes generated file objects to data URLs", () => {
  const urls = normalizeGeneratedMediaUrls(
    [
      { base64: "abcd", mediaType: "image/jpeg" },
      "https://example.com/image.png",
    ],
    "image/png"
  );

  assert.deepEqual(urls, [
    "data:image/jpeg;base64,abcd",
    "https://example.com/image.png",
  ]);
});
