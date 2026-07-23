import assert from "node:assert/strict";
import test from "node:test";
import {
  buildModelProviderConfigs,
  buildProviderOptionsForRoute,
  inferAIProviderTask,
  NVIDIA_NEMOTRON_OMNI_REASONING_MODEL,
  NVIDIA_NEMOTRON_ULTRA_REASONING_MODEL,
  sanitizeFirestoreDocumentData,
  selectModelRouteCandidate,
  type ModelProviderConfig,
} from "./model-router.ts";

function provider(
  id: any,
  overrides: Partial<any> = {}
): any {
  return {
    id,
    name: id,
    baseUrl: `https://${id}.example.com/v1`,
    keyEnvVar: `${id.toUpperCase()}_API_KEY`,
    defaultModel: `${id}-text`,
    visionModel: id === "nvidia" ? `${id}-vision` : undefined,
    capabilities: ["chat", "json"],
    costTier: "free",
    configured: true,
    enabled: true,
    priority: 10,
    ...overrides,
  };
}

test("falls back to NVIDIA before lower-priority cloud providers", () => {
  const route = selectModelRouteCandidate([
    provider("nvidia", { priority: 20, costTier: "free" }),
    provider("together", { priority: 40, costTier: "low" }),
    provider("groq", { priority: 30, costTier: "low" }),
  ]);

  assert.equal(route.provider?.id, "nvidia");
});

test("quality routing mode prefers NVIDIA reasoning over faster free defaults", () => {
  const route = selectModelRouteCandidate(
    [
      provider("nvidia", {
        priority: 30,
        costTier: "free",
        taskModels: {
          deep_business_reasoning: NVIDIA_NEMOTRON_OMNI_REASONING_MODEL,
        },
      }),
      provider("groq", {
        priority: 40,
        costTier: "low",
        taskModels: {
          deep_business_reasoning: "llama-3-70b",
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
      provider("groq", { priority: 20, costTier: "low" }),
      provider("nvidia", { priority: 30, costTier: "free" }),
    ],
    {
      providerId: "nvidia",
      requestedProviderModel: "z-ai/glm-5.2",
    }
  );

  assert.equal(route.provider?.id, "nvidia");
  assert.equal(route.providerModel, "z-ai/glm-5.2");
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

test("defaults NVIDIA reasoning tasks to the responsive chat fallback", () => {
  const previousKey = process.env.NVIDIA_API_KEY;
  const previousReasoningModel = process.env.NVIDIA_REASONING_MODEL;
  const previousWorkflowModel = process.env.NVIDIA_WORKFLOW_MODEL;
  const previousChatModel = process.env.NVIDIA_CHAT_MODEL;

  try {
    process.env.NVIDIA_API_KEY = "test-key";
    delete process.env.NVIDIA_CHAT_MODEL;
    delete process.env.NVIDIA_REASONING_MODEL;
    delete process.env.NVIDIA_WORKFLOW_MODEL;

    const nvidia = buildModelProviderConfigs().find(
      (candidate) => candidate.id === "nvidia"
    );

    assert.equal(nvidia?.defaultModel, "moonshotai/kimi-k2.6");
    assert.equal(
      nvidia?.taskModels?.deep_business_reasoning,
      "moonshotai/kimi-k2.6"
    );
    assert.equal(
      nvidia?.taskModels?.workflow_reasoning,
      "moonshotai/kimi-k2.6"
    );
  } finally {
    if (previousKey === undefined) {
      delete process.env.NVIDIA_API_KEY;
    } else {
      process.env.NVIDIA_API_KEY = previousKey;
    }

    if (previousChatModel === undefined) {
      delete process.env.NVIDIA_CHAT_MODEL;
    } else {
      process.env.NVIDIA_CHAT_MODEL = previousChatModel;
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

test("defaults NVIDIA structured routing to Step 3.7 Flash", () => {
  const previousKey = process.env.NVIDIA_API_KEY;
  const previousRouterModel = process.env.NVIDIA_ROUTER_MODEL;
  const previousJsonModel = process.env.NVIDIA_JSON_MODEL;

  try {
    process.env.NVIDIA_API_KEY = "test-key";
    delete process.env.NVIDIA_ROUTER_MODEL;
    delete process.env.NVIDIA_JSON_MODEL;

    const nvidia = buildModelProviderConfigs().find(
      (candidate) => candidate.id === "nvidia"
    );

    assert.equal(nvidia?.taskModels?.route_selection, "z-ai/glm-5.2");
    assert.equal(nvidia?.taskModels?.json_classification, "z-ai/glm-5.2");
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

    if (previousJsonModel === undefined) {
      delete process.env.NVIDIA_JSON_MODEL;
    } else {
      process.env.NVIDIA_JSON_MODEL = previousJsonModel;
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

test("routes JSON classification only to JSON-capable providers", () => {
  const route = selectModelRouteCandidate(
    [
      provider("together", {
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
    provider("nvidia", { configured: false, enabled: false }),
  ]);

  assert.equal(route.provider, null);
  assert.equal(route.providerModel, null);
  assert.ok(route.decision.unavailableReason);
});

test("requires vision capability for image input", () => {
  const route = selectModelRouteCandidate(
    [
      provider("together", { priority: 10 }),
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

test("requires structured vision capability for screen analysis", () => {
  const route = selectModelRouteCandidate(
    [
      provider("together", {
        priority: 10,
        capabilities: ["chat", "vision"],
      }),
      provider("nvidia", {
        priority: 20,
        capabilities: ["chat", "vision", "json"],
      }),
    ],
    { task: "screen_analysis" }
  );

  assert.equal(route.provider?.id, "nvidia");
  assert.deepEqual(route.decision.requiredCapabilities, ["chat", "vision", "json"]);
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
      fallbacksTried: [undefined, "nvidia"],
    },
  });

  assert.deepEqual(sanitized, {
    usage: {
      inputTokenDetails: {
        cacheReadTokens: 10,
      },
    },
    route: {
      fallbacksTried: [null, "nvidia"],
    },
  });
});

test("prioritizes Mistral provider for route_selection task", () => {
  const route = selectModelRouteCandidate(
    [
      provider("nvidia", { priority: 20 }),
      provider("mistral", { priority: 40 }),
    ],
    { task: "route_selection" }
  );

  assert.equal(route.provider?.id, "mistral");
});
