import assert from "node:assert/strict";
import test from "node:test";
import {
  getImageSizeForAspectRatio,
  getMediaProviderPreference,
  getOpenAICompatibleMediaConfigError,
  generateCloudflareImage,
  hasConfiguredMediaProvider,
  getOpenAICompatibleMediaRuntimeError,
  normalizeGeneratedMediaUrls,
  parseCloudflareImageErrorText,
  resolveCloudflareImageProvider,
  resolveOpenAICompatibleMediaProvider,
} from "./media-provider.ts";

const ENV_KEYS = [
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_AI_API_TOKEN",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_IMAGE_MODEL",
  "CLOUDFLARE_IMAGE_STEPS",
  "MEDIA_IMAGE_PROVIDER",
  "MEDIA_IMAGE_EDIT_PROVIDER",
  "MEDIA_PROVIDER",
  "NVIDIA_API_KEY",
  "NVIDIA_IMAGE_API_KEY",
  "NVIDIA_IMAGE_BASE_URL",
  "NVIDIA_IMAGE_MODEL",
  "NVIDIA_IMAGE_EDIT_MODEL",
  "BROWSER_USE_API_KEY",
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

test("resolves Cloudflare image provider in auto mode", () => {
  withEnv(
    {
      MEDIA_IMAGE_PROVIDER: "auto",
      CLOUDFLARE_ACCOUNT_ID: "account-id",
      CLOUDFLARE_AI_API_TOKEN: "cloudflare-token",
      CLOUDFLARE_IMAGE_MODEL: "@cf/black-forest-labs/flux-1-schnell",
    },
    () => {
      const provider = resolveCloudflareImageProvider("image");

      assert.equal(getMediaProviderPreference("image"), "auto");
      assert.equal(provider?.name, "cloudflare");
      assert.equal(provider?.accountId, "account-id");
      assert.equal(provider?.model, "@cf/black-forest-labs/flux-1-schnell");
      assert.equal(hasConfiguredMediaProvider("image"), true);
    }
  );
});

test("uses Cloudflare model request even when NVIDIA is selected", () => {
  withEnv(
    {
      MEDIA_IMAGE_PROVIDER: "nvidia",
      CLOUDFLARE_ACCOUNT_ID: "account-id",
      CLOUDFLARE_AI_API_TOKEN: "cloudflare-token",
    },
    () => {
      const provider = resolveCloudflareImageProvider(
        "image",
        "@cf/black-forest-labs/flux-1-schnell"
      );

      assert.equal(provider?.name, "cloudflare");
      assert.equal(provider?.model, "@cf/black-forest-labs/flux-1-schnell");
    }
  );
});

test("does not route explicit non-Cloudflare image models to Cloudflare", () => {
  withEnv(
    {
      MEDIA_IMAGE_PROVIDER: "auto",
      CLOUDFLARE_ACCOUNT_ID: "account-id",
      CLOUDFLARE_AI_API_TOKEN: "cloudflare-token",
    },
    () => {
      assert.equal(
        resolveCloudflareImageProvider("image", "qwen-image-2512"),
        null
      );
    }
  );
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

test("explains Cloudflare image config when selected without credentials", () => {
  withEnv({ MEDIA_IMAGE_PROVIDER: "cloudflare" }, () => {
    assert.equal(resolveCloudflareImageProvider("image"), null);
    assert.match(
      getOpenAICompatibleMediaConfigError("image"),
      /CLOUDFLARE_ACCOUNT_ID/
    );
  });
});

test("rejects OpenRouter keys in Cloudflare image config", () => {
  withEnv(
    {
      MEDIA_IMAGE_PROVIDER: "cloudflare",
      CLOUDFLARE_ACCOUNT_ID: "account-id",
      CLOUDFLARE_AI_API_TOKEN: "sk-or-test",
    },
    () => {
      assert.equal(resolveCloudflareImageProvider("image"), null);
      assert.match(
        getOpenAICompatibleMediaConfigError("image"),
        /OpenRouter key/
      );
    }
  );
});

test("explains that Browser Use keys do not configure image generation", () => {
  withEnv(
    {
      MEDIA_IMAGE_PROVIDER: "nvidia",
      NVIDIA_API_KEY: "test-key",
      NVIDIA_IMAGE_MODEL: "qwen-image-2512",
      BROWSER_USE_API_KEY: "browser-use-key",
    },
    () => {
      const message = getOpenAICompatibleMediaConfigError("image");

      assert.match(message, /BROWSER_USE_API_KEY/);
      assert.match(message, /browser automation/);
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

test("generates Cloudflare image data URLs from JSON responses", async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async (url, init) => {
      assert.match(String(url), /\/ai\/run\/@cf\/black-forest-labs\/flux-1-schnell$/);
      assert.equal(
        (init?.headers as Record<string, string>).Authorization,
        "Bearer cloudflare-token"
      );
      assert.deepEqual(JSON.parse(String(init?.body)), {
        prompt: "cyberpunk cat",
        steps: 4,
      });

      return new Response(
        JSON.stringify({ success: true, result: { image: "abcd" } }),
        { headers: { "content-type": "application/json" } }
      );
    };

    const result = await generateCloudflareImage({
      provider: {
        accountId: "account-id",
        apiBaseUrl: "https://api.cloudflare.com/client/v4",
        apiToken: "cloudflare-token",
        model: "@cf/black-forest-labs/flux-1-schnell",
        name: "cloudflare",
        steps: 4,
      },
      prompt: "cyberpunk cat",
      aspectRatio: "1:1",
    });

    assert.equal(result.provider, "cloudflare");
    assert.equal(result.image, "data:image/jpeg;base64,abcd");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("parses Cloudflare image error responses safely", () => {
  assert.equal(
    parseCloudflareImageErrorText(
      '{"errors":[{"message":"bad token"},"rate limited"]}',
      "fallback"
    ),
    "bad token; rate limited"
  );
  assert.equal(
    parseCloudflareImageErrorText(
      'Cloudflare said: {"errors":[{"message":"Use {valid} account"}]} trailing {bad}',
      "fallback"
    ),
    "Use {valid} account"
  );
  assert.equal(
    parseCloudflareImageErrorText(" plain failure ".repeat(60), "fallback").length,
    500
  );
  assert.equal(parseCloudflareImageErrorText(" ", "fallback"), "fallback");
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
