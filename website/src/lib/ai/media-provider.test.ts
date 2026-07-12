import assert from "node:assert/strict";
import test from "node:test";
import {
  getImageSizeForAspectRatio,
  getMediaProviderPreference,
  getOpenAICompatibleMediaConfigError,
  hasConfiguredMediaProvider,
  getOpenAICompatibleMediaRuntimeError,
  normalizeGeneratedMediaUrls,
  normalizeInputImageUrls,
  resolveNvidiaGenAIImageProvider,
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
  const originalFallback = process.env.REARVY_DISABLE_ENV_FILE_FALLBACK;

  try {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
    process.env.REARVY_DISABLE_ENV_FILE_FALLBACK = "1";

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
    if (originalFallback === undefined) {
      delete process.env.REARVY_DISABLE_ENV_FILE_FALLBACK;
    } else {
      process.env.REARVY_DISABLE_ENV_FILE_FALLBACK = originalFallback;
    }
  }
}

test("uses NVIDIA image provider when selected with API key", () => {
  withEnv(
    {
      MEDIA_IMAGE_PROVIDER: "nvidia",
      NVIDIA_IMAGE_API_KEY: "test-key",
      NVIDIA_IMAGE_MODEL: "qwen-image-2512",
    },
    () => {
      const provider = resolveOpenAICompatibleMediaProvider("image");

      assert.equal(getMediaProviderPreference("image"), "nvidia");
      assert.equal(provider?.name, "nvidia");
      assert.equal(provider?.model, "qwen-image-2512");
    }
  );
});

test("uses NVIDIA image provider with custom NIM base URL", () => {
  withEnv(
    {
      MEDIA_IMAGE_PROVIDER: "nvidia",
      NVIDIA_API_KEY: "test-key",
      NVIDIA_IMAGE_BASE_URL: "http://localhost:8000/v1",
      NVIDIA_IMAGE_MODEL: "qwen-image-2512",
    },
    () => {
      const provider = resolveOpenAICompatibleMediaProvider("image");

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
      NVIDIA_IMAGE_MODEL: "qwen-image-2512",
    },
    () => {
      const provider = resolveOpenAICompatibleMediaProvider("image");

      assert.equal(provider?.apiKey, "image-key");
    }
  );
});

test("auto image provider resolves to NVIDIA when API key is configured", () => {
  withEnv(
    {
      MEDIA_IMAGE_PROVIDER: "auto",
      NVIDIA_IMAGE_API_KEY: "test-key",
      NVIDIA_IMAGE_MODEL: "qwen-image-2512",
    },
    () => {
      const provider = resolveOpenAICompatibleMediaProvider("image");

      assert.equal(getMediaProviderPreference("image"), "auto");
      assert.equal(provider?.name, "nvidia");
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

test("returns null provider when no API key is configured", () => {
  withEnv(
    {
      MEDIA_IMAGE_PROVIDER: "nvidia",
      NVIDIA_IMAGE_MODEL: "qwen-image-2512",
    },
    () => {
      assert.equal(resolveOpenAICompatibleMediaProvider("image"), null);
      assert.match(
        getOpenAICompatibleMediaConfigError("image"),
        /NVIDIA_IMAGE_API_KEY/
      );
    }
  );
});

test("resolves NVIDIA GenAI provider when API key is set (no NIM URL needed)", () => {
  withEnv(
    {
      NVIDIA_IMAGE_API_KEY: "test-key",
    },
    () => {
      const provider = resolveNvidiaGenAIImageProvider("image");

      assert.ok(provider, "should resolve a provider");
      assert.equal(provider?.name, "nvidia");
      assert.match(provider?.baseUrl ?? "", /ai\.api\.nvidia\.com/);
      assert.match(provider?.model ?? "", /flux-schnell/);
    }
  );
});

test("GenAI provider returns null for image-edit and video modes", () => {
  withEnv({ NVIDIA_IMAGE_API_KEY: "test-key" }, () => {
    assert.equal(resolveNvidiaGenAIImageProvider("image-edit"), null);
    assert.equal(resolveNvidiaGenAIImageProvider("video"), null);
  });
});

test("GenAI provider returns null when no API key is configured", () => {
  withEnv({}, () => {
    assert.equal(resolveNvidiaGenAIImageProvider("image"), null);
  });
});

test("uses custom NVIDIA GenAI model when NVIDIA_GENAI_IMAGE_MODEL is set", () => {
  // NVIDIA_GENAI_IMAGE_MODEL is not in ENV_KEYS so set directly
  const original = process.env.NVIDIA_GENAI_IMAGE_MODEL;
  process.env.REARVY_DISABLE_ENV_FILE_FALLBACK = "1";
  try {
    withEnv({ NVIDIA_IMAGE_API_KEY: "test-key" }, () => {
      process.env.NVIDIA_GENAI_IMAGE_MODEL = "black-forest-labs/flux-dev";
      const provider = resolveNvidiaGenAIImageProvider("image");
      assert.equal(provider?.model, "black-forest-labs/flux-dev");
    });
  } finally {
    if (original === undefined) {
      delete process.env.NVIDIA_GENAI_IMAGE_MODEL;
    } else {
      process.env.NVIDIA_GENAI_IMAGE_MODEL = original;
    }
    delete process.env.REARVY_DISABLE_ENV_FILE_FALLBACK;
  }
});

test("hasConfiguredMediaProvider returns true when GenAI API key is present", () => {
  withEnv(
    {
      NVIDIA_IMAGE_API_KEY: "test-key",
      NVIDIA_IMAGE_MODEL: "qwen-image-2512",
    },
    () => {
      assert.equal(hasConfiguredMediaProvider("image"), true);
    }
  );
});

test("hasConfiguredMediaProvider returns false without any key", () => {
  withEnv({}, () => {
    assert.equal(hasConfiguredMediaProvider("image"), false);
  });
});

test("routes image edits to NVIDIA", () => {
  withEnv(
    {
      MEDIA_IMAGE_PROVIDER: "auto",
      NVIDIA_API_KEY: "test-key",
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
      NVIDIA_IMAGE_API_KEY: "test-key",
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
      NVIDIA_IMAGE_API_KEY: "test-key",
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

test("maps NVIDIA 404s to a helpful error message", () => {
  const message = getOpenAICompatibleMediaRuntimeError(
    new Error("Not Found"),
    "nvidia",
    "image"
  );

  assert.match(message, /404/);
  assert.match(message, /qwen-image-2512/);
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

test("normalizes generated media outputs with safe URLs and media types only", () => {
  const urls = normalizeGeneratedMediaUrls(
    [
      { url: "javascript:alert(1)" },
      "blob:https://example.com/asset",
      "data:text/html;base64,PGgxPg==",
      { base64: "abcd", mediaType: "image/svg+xml" },
      { url: " https://example.com/safe.webp " },
      "rawBase64==",
      "not base64: nope",
    ],
    "image/png"
  );

  assert.deepEqual(urls, [
    "data:image/png;base64,abcd",
    "https://example.com/safe.webp",
    "data:image/png;base64,rawBase64==",
  ]);
});

test("normalizes input image URLs before image edit calls", () => {
  const urls = normalizeInputImageUrls([
    " https://example.com/input.png ",
    "javascript:alert(1)",
    "data:image/png;base64,abcd",
    "data:text/html;base64,PGgxPg==",
    "https://example.com/second.jpg",
    "https://example.com/third.webp",
  ]);

  assert.deepEqual(urls, [
    "https://example.com/input.png",
    "data:image/png;base64,abcd",
    "https://example.com/second.jpg",
  ]);
});
