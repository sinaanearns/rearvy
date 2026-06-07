import assert from "node:assert/strict";
import test from "node:test";
import {
  buildModelProviderConfigs,
  buildProviderOptionsForRoute,
  extractOllamaModelNames,
  inferAIProviderTask,
  NVIDIA_NEMOTRON_OMNI_REASONING_MODEL,
  NVIDIA_NEMOTRON_ULTRA_REASONING_MODEL,
  sanitizeFirestoreDocumentData,
  selectModelRouteCandidate,
  type ModelProviderConfig,
} from "./model-router.ts";

function provider(
  id: ModelProviderConfig["id"],
  overrides: Partial<ModelProviderConfig> = {}
): ModelProviderConfig {
  return {
    id,
    name: id,
    baseUrl: `https://${id}.example.com/v1`,
    keyEnvVar: id === "local_ollama" ? null : `${id.toUpperCase()}_API_KEY`,
    defaultModel: `${id}-text`,
    visionModel: id === "nvidia" ? `${id}-vision` : undefined,
    capabilities: ["chat", "json"],
    costTier: id === "local_ollama" ? "local" : "free",
    configured: true,
    enabled: true,
    priority: 10,
    ...overrides,
  };
}

test("prefers local inference when it is enabled and reachable", () => {
  const route = selectModelRouteCandidate([
    provider("nvidia", { priority: 20 }),
    provider("local_ollama", { priority: 10 }),
  ]);

  assert.equal(route.provider?.id, "local_ollama");
  assert.equal(route.providerModel, "local_ollama-text");
});

test("uses an installed Ollama chat model when the configured default is missing", () => {
  const route = selectModelRouteCandidate([
    provider("local_ollama", {
      priority: 10,
      defaultModel: "llama3.1:8b",
      health: {
        status: "available",
        checkedAt: new Date(0).toISOString(),
        availableModels: ["qwen2.5:7b", "nomic-embed-text:latest"],
      },
    }),
  ]);

  assert.equal(route.provider?.id, "local_ollama");
  assert.equal(route.providerModel, "qwen2.5:7b");
});

test("extracts Ollama model names from health payloads safely", () => {
  assert.deepEqual(
    extractOllamaModelNames({
      models: [
        { name: "qwen2.5:7b" },
        { model: "llama3.1:8b" },
        { name: "nomic-embed-text" },
        { model: "nomic-embed-text:latest" },
        null,
        "bad",
        ["bad"],
        { name: " " },
      ],
    }),
    ["qwen2.5:7b", "llama3.1:8b", "nomic-embed-text"]
  );

  assert.deepEqual(extractOllamaModelNames(null), []);
  assert.deepEqual(extractOllamaModelNames({ models: "bad" }), []);
});

test("falls back when the configured Ollama model is not installed", () => {
  const route = selectModelRouteCandidate([
    provider("local_ollama", {
      priority: 10,
      defaultModel: "llama3.1:8b",
      health: {
        status: "available",
        checkedAt: new Date(0).toISOString(),
        availableModels: [],
      },
    }),
    provider("nvidia", { priority: 20, costTier: "free" }),
  ]);

  assert.equal(route.provider?.id, "nvidia");
  assert.deepEqual(route.decision.fallbacksTried, ["local_ollama"]);
});

test("falls back to NVIDIA before lower-priority cloud providers", () => {
  const route = selectModelRouteCandidate([
    provider("local_ollama", {
      priority: 10,
      health: {
        status: "unreachable",
        checkedAt: new Date(0).toISOString(),
      },
    }),
    provider("groq", { priority: 30, costTier: "low" }),
    provider("nvidia", { priority: 20, costTier: "free" }),
  ]);

  assert.equal(route.provider?.id, "nvidia");
  assert.deepEqual(route.decision.fallbacksTried, ["local_ollama"]);
});

test("uses OpenRouter before NVIDIA when both free providers are available", () => {
  const route = selectModelRouteCandidate([
    provider("nvidia", { priority: 30, costTier: "free" }),
    provider("openrouter", { priority: 20, costTier: "free" }),
  ]);

  assert.equal(route.provider?.id, "openrouter");
});

test("quality routing mode prefers NVIDIA reasoning over faster free defaults", () => {
  const route = selectModelRouteCandidate(
    [
      provider("openrouter", {
        priority: 20,
        costTier: "free",
        taskModels: {
          deep_business_reasoning: "qwen/qwen3-next-80b-a3b-instruct:free",
        },
      }),
      provider("nvidia", {
        priority: 30,
        costTier: "free",
        taskModels: {
          deep_business_reasoning: NVIDIA_NEMOTRON_OMNI_REASONING_MODEL,
        },
      }),
    ],
    {
      task: "deep_business_reasoning",
      routingMode: "quality",
      maxCostTier: "premium",
    }
  );

  assert.equal(route.provider?.id, "nvidia");
  assert.equal(route.providerModel, NVIDIA_NEMOTRON_OMNI_REASONING_MODEL);
  assert.equal(route.decision.routingMode, "quality");
});

test("routes content creation requests to deeper reasoning", () => {
  assert.equal(
    inferAIProviderTask({
      text: "write a LinkedIn post about my creator business",
    }),
    "deep_business_reasoning"
  );
});

test("honors explicit NVIDIA provider requests", () => {
  const route = selectModelRouteCandidate(
    [
      provider("openrouter", { priority: 20, costTier: "free" }),
      provider("nvidia", { priority: 30, costTier: "free" }),
    ],
    {
      providerId: "nvidia",
      requestedProviderModel: "stepfun-ai/step-3.7-flash",
    }
  );

  assert.equal(route.provider?.id, "nvidia");
  assert.equal(route.providerModel, "stepfun-ai/step-3.7-flash");
});

test("treats model-specific NVIDIA keys as configured", () => {
  const previousNvidiaKey = process.env.NVIDIA_API_KEY;
  const previousDeepseekKey = process.env.NVIDIA_DEEPSEEK_API_KEY;
  const previousNemotronKey = process.env.NVIDIA_NEMOTRON_API_KEY;

  try {
    delete process.env.NVIDIA_API_KEY;
    delete process.env.NVIDIA_DEEPSEEK_API_KEY;
    process.env.NVIDIA_NEMOTRON_API_KEY = "test-key";

    const nvidia = buildModelProviderConfigs().find(
      (candidate) => candidate.id === "nvidia"
    );

    assert.equal(nvidia?.configured, true);
    assert.equal(nvidia?.enabled, true);
  } finally {
    if (previousNvidiaKey === undefined) {
      delete process.env.NVIDIA_API_KEY;
    } else {
      process.env.NVIDIA_API_KEY = previousNvidiaKey;
    }

    if (previousDeepseekKey === undefined) {
      delete process.env.NVIDIA_DEEPSEEK_API_KEY;
    } else {
      process.env.NVIDIA_DEEPSEEK_API_KEY = previousDeepseekKey;
    }

    if (previousNemotronKey === undefined) {
      delete process.env.NVIDIA_NEMOTRON_API_KEY;
    } else {
      process.env.NVIDIA_NEMOTRON_API_KEY = previousNemotronKey;
    }
  }
});

test("defaults NVIDIA reasoning tasks to DeepSeek V4 Pro", () => {
  const previousKey = process.env.NVIDIA_API_KEY;
  const previousReasoningModel = process.env.NVIDIA_REASONING_MODEL;
  const previousWorkflowModel = process.env.NVIDIA_WORKFLOW_MODEL;

  try {
    process.env.NVIDIA_API_KEY = "test-key";
    delete process.env.NVIDIA_REASONING_MODEL;
    delete process.env.NVIDIA_WORKFLOW_MODEL;

    const nvidia = buildModelProviderConfigs().find(
      (candidate) => candidate.id === "nvidia"
    );

    assert.equal(
      nvidia?.taskModels?.deep_business_reasoning,
      "deepseek-ai/deepseek-v4-pro"
    );
    assert.equal(
      nvidia?.taskModels?.workflow_reasoning,
      "deepseek-ai/deepseek-v4-pro"
    );
  } finally {
    if (previousKey === undefined) {
      delete process.env.NVIDIA_API_KEY;
    } else {
      process.env.NVIDIA_API_KEY = previousKey;
    }

    if (previousReasoningModel === undefined) {
      delete process.env.NVIDIA_REASONING_MODEL;
    } else {
      process.env.NVIDIA_REASONING_MODEL = previousReasoningModel;
    }

    if (previousWorkflowModel === undefined) {
      delete process.env.NVIDIA_WORKFLOW_MODEL;
    } else {
      process.env.NVIDIA_WORKFLOW_MODEL = previousWorkflowModel;
    }
  }
});

test("defaults NVIDIA route selection to DeepSeek V4 Pro", () => {
  const previousKey = process.env.NVIDIA_API_KEY;
  const previousRouterModel = process.env.NVIDIA_ROUTER_MODEL;

  try {
    process.env.NVIDIA_API_KEY = "test-key";
    delete process.env.NVIDIA_ROUTER_MODEL;

    const nvidia = buildModelProviderConfigs().find(
      (candidate) => candidate.id === "nvidia"
    );

    assert.equal(nvidia?.taskModels?.route_selection, "deepseek-ai/deepseek-v4-pro");
  } finally {
    if (previousKey === undefined) {
      delete process.env.NVIDIA_API_KEY;
    } else {
      process.env.NVIDIA_API_KEY = previousKey;
    }

    if (previousRouterModel === undefined) {
      delete process.env.NVIDIA_ROUTER_MODEL;
    } else {
      process.env.NVIDIA_ROUTER_MODEL = previousRouterModel;
    }
  }
});

test("adds NVIDIA Nemotron thinking provider options only when enabled", () => {
  assert.deepEqual(
    buildProviderOptionsForRoute({
      providerId: "nvidia",
      providerModel: NVIDIA_NEMOTRON_ULTRA_REASONING_MODEL,
      enableReasoning: true,
      reasoningBudget: 16384,
    }),
    {
      nvidia: {
        chat_template_kwargs: {
          enable_thinking: true,
        },
        reasoning_budget: 16384,
      },
    }
  );

  assert.deepEqual(
    buildProviderOptionsForRoute({
      providerId: "nvidia",
      providerModel: NVIDIA_NEMOTRON_OMNI_REASONING_MODEL,
      enableReasoning: true,
      reasoningBudget: 8192,
    }),
    {
      nvidia: {
        chat_template_kwargs: {
          enable_thinking: true,
        },
        reasoning_budget: 8192,
      },
    }
  );

  assert.equal(
    buildProviderOptionsForRoute({
      providerId: "nvidia",
      providerModel: NVIDIA_NEMOTRON_OMNI_REASONING_MODEL,
      enableReasoning: false,
    }),
    undefined
  );
});

test("adds NVIDIA DeepSeek non-thinking provider options", () => {
  assert.deepEqual(
    buildProviderOptionsForRoute({
      providerId: "nvidia",
      providerModel: "deepseek-ai/deepseek-v4-pro",
    }),
    {
      nvidia: {
        chat_template_kwargs: {
          thinking: false,
        },
      },
    }
  );
});

test("maps legacy NVIDIA Ministral IDs to OpenRouter's current model ID", () => {
  const route = selectModelRouteCandidate(
    [provider("openrouter", { priority: 20, costTier: "free" })],
    {
      requestedProviderModel: "mistralai/ministral-14b-instruct-2512",
    }
  );

  assert.equal(route.provider?.id, "openrouter");
  assert.equal(route.providerModel, "mistralai/ministral-14b-2512");
});

test("routes JSON classification only to JSON-capable providers", () => {
  const route = selectModelRouteCandidate(
    [
      provider("openrouter", {
        priority: 20,
        capabilities: ["chat"],
      }),
      provider("nvidia", {
        priority: 30,
        capabilities: ["chat", "json"],
      }),
    ],
    { task: "json_classification" }
  );

  assert.equal(route.provider?.id, "nvidia");
  assert.deepEqual(route.decision.requiredCapabilities, ["chat", "json"]);
});

test("does not use premium providers unless premium is allowed", () => {
  const route = selectModelRouteCandidate([
    provider("openai", { priority: 10, costTier: "premium" }),
    provider("groq", { priority: 40, costTier: "low" }),
  ]);

  assert.equal(route.provider, null);
  assert.equal(route.providerModel, null);

  const premiumRoute = selectModelRouteCandidate(
    [provider("openai", { priority: 10, costTier: "premium" })],
    { allowPremium: true, maxCostTier: "premium" }
  );

  assert.equal(premiumRoute.provider?.id, "openai");
});

test("skips unconfigured providers without throwing", () => {
  const route = selectModelRouteCandidate([
    provider("local_ollama", { configured: false, enabled: false }),
    provider("nvidia", { configured: false, enabled: false }),
  ]);

  assert.equal(route.provider, null);
  assert.equal(route.providerModel, null);
  assert.ok(route.decision.unavailableReason);
});

test("requires vision capability for image input", () => {
  const route = selectModelRouteCandidate(
    [
      provider("local_ollama", { priority: 10 }),
      provider("nvidia", {
        priority: 20,
        capabilities: ["chat", "vision", "json"],
      }),
    ],
    { hasImageInput: true, requestedProviderModel: "requested-nvidia-model" }
  );

  assert.equal(route.provider?.id, "nvidia");
  assert.equal(route.providerModel, "nvidia-vision");
});

test("removes nested undefined fields from Firestore telemetry data", () => {
  const sanitized = sanitizeFirestoreDocumentData({
    usage: {
      inputTokenDetails: {
        cacheReadTokens: 10,
        cacheWriteTokens: undefined,
      },
    },
    route: {
      fallbacksTried: [undefined, "openrouter"],
    },
  });

  assert.deepEqual(sanitized, {
    usage: {
      inputTokenDetails: {
        cacheReadTokens: 10,
      },
    },
    route: {
      fallbacksTried: [null, "openrouter"],
    },
  });
});
