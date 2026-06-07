import { createHash } from "node:crypto";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  generateText as aiGenerateText,
  generateObject as aiGenerateObject,
  streamText as aiStreamText,
  type LanguageModel,
} from "ai";
import type { ProviderOptions } from "@ai-sdk/provider-utils";
import { z } from "zod";
import { createServerLogger } from "@/lib/server-logger";
import { detectContentCreationIntent } from "./content-creation";

const log = createServerLogger("ModelRouter");

export type ModelProviderId =
  | "local_ollama"
  | "openrouter"
  | "nvidia"
  | "groq"
  | "together"
  | "openai";

export type ModelCostTier = "local" | "free" | "low" | "premium";

export type ModelRoutingMode = "fast" | "quality";

export type AutoRouteAnswerPriority = "speed" | "balanced" | "quality";

export type ModelProviderCapability =
  | "chat"
  | "vision"
  | "tools"
  | "embeddings"
  | "json";

export type AIProviderTask =
  | "chat_assistant"
  | "summary"
  | "email_draft"
  | "memory_tagging"
  | "analytics_explanation"
  | "deep_business_reasoning"
  | "json_classification"
  | "route_selection"
  | "workflow_reasoning"
  | "screen_analysis";

export type ProviderHealthStatus =
  | "available"
  | "configured"
  | "unconfigured"
  | "unreachable"
  | "rate_limited";

export type ModelProviderHealth = {
  status: ProviderHealthStatus;
  checkedAt: string;
  latencyMs?: number;
  reason?: string;
  availableModels?: string[];
  rateLimitResetAt?: string | null;
  failureCount?: number;
  timeoutCount?: number;
};

export type ProviderFailureRecord = {
  providerId: ModelProviderId;
  providerModel: string | null;
  reason: string;
  retryable: boolean;
  statusCode?: number | null;
  failedAt: string;
};

export type ModelProviderConfig = {
  id: ModelProviderId;
  name: string;
  baseUrl: string;
  keyEnvVar: string | null;
  defaultModel: string;
  taskModels?: Partial<Record<AIProviderTask, string>>;
  visionModel?: string;
  capabilities: ModelProviderCapability[];
  costTier: ModelCostTier;
  configured: boolean;
  enabled: boolean;
  priority: number;
  health?: ModelProviderHealth;
  includeUsage?: boolean;
  supportsStructuredOutputs?: boolean;
  supportsResponseCache?: boolean;
  attributionHeaders?: Record<string, string>;
};

export type ModelRouteDecision = {
  providerId: ModelProviderId | null;
  providerName: string | null;
  providerModel: string | null;
  costTier: ModelCostTier | null;
  baseUrl: string | null;
  reason: string;
  requestedModel: string | null;
  task: AIProviderTask;
  requiredCapabilities: ModelProviderCapability[];
  localPreferred: boolean;
  fallbacksTried: string[];
  fallbackFailures: ProviderFailureRecord[];
  unavailableReason: string | null;
  capabilities: ModelProviderCapability[];
  latencyMs?: number;
  usage?: Record<string, unknown> | null;
  cacheStatus?: "hit" | "miss" | "bypass";
  routingMode?: ModelRoutingMode;
  routing?: {
    providerId: ModelProviderId | null;
    providerModel: string | null;
    selectedTask: AIProviderTask;
    answerPriority: AutoRouteAnswerPriority;
    reason: string | null;
  } | null;
  selectedAt: string;
};

export type ModelRouteOptions = {
  providerId?: ModelProviderId | null;
  requestedProviderModel?: string | null;
  task?: AIProviderTask;
  hasImageInput?: boolean;
  allowLocal?: boolean;
  allowPremium?: boolean;
  maxCostTier?: ModelCostTier;
  requiredCapabilities?: ModelProviderCapability[];
  excludeProviderIds?: ModelProviderId[];
  fallbackFailures?: ProviderFailureRecord[];
  routingMode?: ModelRoutingMode;
  routing?: ModelRouteDecision["routing"];
  now?: Date;
};

export type ResolveModelForChatOptions = {
  providerId?: ModelProviderId | null;
  requestedProviderModel?: string | null;
  task?: AIProviderTask;
  hasImageInput?: boolean;
  isDesktopApp?: boolean;
  allowPremium?: boolean;
  maxCostTier?: ModelCostTier;
  requiredCapabilities?: ModelProviderCapability[];
  autoRoute?: boolean;
  routingText?: string | null;
  routingMode?: ModelRoutingMode;
  routing?: ModelRouteDecision["routing"];
};

export type RoutedChatModel = {
  model: LanguageModel | null;
  decision: ModelRouteDecision;
  provider: ModelProviderConfig | null;
};

type AIProviderSettings = {
  enabledProviders?: Partial<Record<ModelProviderId, boolean>>;
  providerPriority?: Partial<Record<ModelProviderId, number>>;
  providerModels?: Partial<Record<ModelProviderId, string>>;
  taskModels?: Partial<Record<AIProviderTask, Partial<Record<ModelProviderId, string>>>>;
  allowPremium?: boolean;
  maxCostTier?: ModelCostTier;
  updatedAt?: string;
};

type CompletionBaseRequest = {
  providerId?: ModelProviderId | null;
  task?: AIProviderTask;
  system?: string;
  prompt?: string;
  messages?: unknown[];
  requestedProviderModel?: string | null;
  hasImageInput?: boolean;
  isDesktopApp?: boolean;
  allowPremium?: boolean;
  allowLocal?: boolean;
  maxCostTier?: ModelCostTier;
  routingMode?: ModelRoutingMode;
  userId?: string | null;
  projectId?: string | null;
  chatId?: string | null;
  cache?: boolean;
  timeoutMs?: number;
  maxOutputTokens?: number;
  temperature?: number;
  enableProviderReasoning?: boolean;
  reasoningBudget?: number;
};

export type GenerateTextRequest = CompletionBaseRequest & {
  abortSignal?: AbortSignal;
};

export type AITextResult = {
  text: string;
  modelRoute: ModelRouteDecision;
  aiUnavailable?: boolean;
  usage?: unknown;
  finishReason?: unknown;
  [key: string]: unknown;
};

export type StreamTextRequest = CompletionBaseRequest & {
  tools?: Record<string, unknown>;
  stopWhen?: unknown;
  prepareStep?: unknown;
  onFinish?: (event: unknown) => void | Promise<void>;
  onError?: (event: unknown) => void | Promise<void>;
};

export type GenerateObjectRequest<TSchema extends z.ZodTypeAny> =
  CompletionBaseRequest & {
    schema: TSchema;
  };

export type AIObjectResult<T> = {
  object: T;
  modelRoute: ModelRouteDecision;
  [key: string]: unknown;
};

export type AIStreamTextResult = {
  toTextStreamResponse: () => Response;
  toUIMessageStreamResponse: () => Response;
  [key: string]: unknown;
};

function isAIStreamTextResult(value: unknown): value is AIStreamTextResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const result = value as {
    toTextStreamResponse?: unknown;
    toUIMessageStreamResponse?: unknown;
  };

  return (
    typeof result.toTextStreamResponse === "function" &&
    typeof result.toUIMessageStreamResponse === "function"
  );
}

function ensureAIStreamTextResult(value: unknown): AIStreamTextResult {
  if (!isAIStreamTextResult(value)) {
    throw new Error("AI stream result is missing expected response helpers.");
  }

  return value;
}

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const TOGETHER_BASE_URL = "https://api.together.xyz/v1";
const OPENAI_BASE_URL = "https://api.openai.com/v1";
const ROUTER_SETTINGS_DOC_ID = "global";
const HEALTH_TTL_MS = 60_000;
const SETTINGS_TTL_MS = 30_000;
const PROMPT_CACHE_TTL_MS = 10 * 60_000;
const PROMPT_CACHE_MAX_ENTRIES = 128;
const NVIDIA_KIMI_K2_6_MODEL = "moonshotai/kimi-k2.6";
const NVIDIA_MINISTRAL_14B_MODEL = "mistralai/ministral-14b-instruct-2512";
const NVIDIA_STEP_3_7_FLASH_MODEL = "stepfun-ai/step-3.7-flash";
const NVIDIA_GLM_5_1_MODEL = "z-ai/glm-5.1";
const NVIDIA_DEEPSEEK_V4_PRO_MODEL = "deepseek-ai/deepseek-v4-pro";
const NVIDIA_LLAMA_VISION_MODEL = "meta/llama-3.2-11b-vision-instruct";
const NVIDIA_CONTENT_SAFETY_MODEL = "nvidia/nemotron-3-content-safety";
export const NVIDIA_NEMOTRON_OMNI_REASONING_MODEL =
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning";
export const NVIDIA_NEMOTRON_ULTRA_REASONING_MODEL =
  "nvidia/nemotron-3-ultra-550b-a55b";
const NVIDIA_NEMOTRON_REASONING_MODELS = new Set([
  NVIDIA_NEMOTRON_OMNI_REASONING_MODEL,
  NVIDIA_NEMOTRON_ULTRA_REASONING_MODEL,
]);
const OPENROUTER_MINISTRAL_14B_MODEL = "mistralai/ministral-14b-2512";
const NVIDIA_MODEL_KEY_ENV_VARS: Record<string, string> = {
  [NVIDIA_KIMI_K2_6_MODEL]: "NVIDIA_KIMI_API_KEY",
  [NVIDIA_GLM_5_1_MODEL]: "NVIDIA_GLM_API_KEY",
  [NVIDIA_DEEPSEEK_V4_PRO_MODEL]: "NVIDIA_DEEPSEEK_API_KEY",
  [NVIDIA_STEP_3_7_FLASH_MODEL]: "NVIDIA_STEP_API_KEY",
  [NVIDIA_NEMOTRON_OMNI_REASONING_MODEL]: "NVIDIA_NEMOTRON_API_KEY",
  [NVIDIA_NEMOTRON_ULTRA_REASONING_MODEL]: "NVIDIA_NEMOTRON_API_KEY",
  [NVIDIA_CONTENT_SAFETY_MODEL]: "NVIDIA_CONTENT_SAFETY_API_KEY",
};
const NVIDIA_API_KEY_ENV_VARS = [
  "NVIDIA_API_KEY",
  ...Object.values(NVIDIA_MODEL_KEY_ENV_VARS),
];

const OPENROUTER_MODEL_ALIASES: Record<string, string> = {
  [NVIDIA_MINISTRAL_14B_MODEL]: OPENROUTER_MINISTRAL_14B_MODEL,
};

const AUTO_ROUTE_TASKS = [
  "chat_assistant",
  "summary",
  "email_draft",
  "analytics_explanation",
  "deep_business_reasoning",
  "workflow_reasoning",
  "screen_analysis",
] as const;

const AutoRouteDecisionSchema = z.object({
  task: z.enum(AUTO_ROUTE_TASKS),
  answerPriority: z.enum(["speed", "balanced", "quality"]).default("balanced"),
  reason: z.string().trim().max(240).optional().nullable(),
});

type AutoRouteDecision = z.infer<typeof AutoRouteDecisionSchema>;

const COST_RANK: Record<ModelCostTier, number> = {
  local: 0,
  free: 1,
  low: 2,
  premium: 3,
};

const OPENROUTER_FREE_MODELS = [
  "openrouter/free",
  "deepseek/deepseek-v4-flash:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "qwen/qwen3-coder:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
] as const;

const TASK_DEFAULTS: Record<
  AIProviderTask,
  {
    requiredCapabilities: ModelProviderCapability[];
    maxCostTier: ModelCostTier;
    description: string;
  }
> = {
  chat_assistant: {
    requiredCapabilities: ["chat"],
    maxCostTier: "free",
    description: "General assistant chat should prefer free, fast models.",
  },
  summary: {
    requiredCapabilities: ["chat"],
    maxCostTier: "free",
    description: "Summaries should use cheap or free models.",
  },
  email_draft: {
    requiredCapabilities: ["chat"],
    maxCostTier: "free",
    description: "Email drafting should use lightweight models.",
  },
  memory_tagging: {
    requiredCapabilities: ["chat", "json"],
    maxCostTier: "free",
    description: "Memory tagging should prefer local/free JSON-capable models.",
  },
  analytics_explanation: {
    requiredCapabilities: ["chat"],
    maxCostTier: "low",
    description: "Analytics explanations can use medium models when configured.",
  },
  deep_business_reasoning: {
    requiredCapabilities: ["chat"],
    maxCostTier: "premium",
    description: "Deep reasoning may use stronger configured providers.",
  },
  json_classification: {
    requiredCapabilities: ["chat", "json"],
    maxCostTier: "free",
    description: "Structured classification must use JSON-capable models.",
  },
  route_selection: {
    requiredCapabilities: ["chat", "json"],
    maxCostTier: "free",
    description: "Fast model routing should use cheap JSON-capable models.",
  },
  workflow_reasoning: {
    requiredCapabilities: ["chat", "json"],
    maxCostTier: "free",
    description: "Workflow planning should use structured free models first.",
  },
  screen_analysis: {
    requiredCapabilities: ["chat", "vision"],
    maxCostTier: "free",
    description: "Screen analysis needs vision-capable models.",
  },
};

let settingsCache:
  | {
      loadedAt: number;
      settings: AIProviderSettings | null;
    }
  | null = null;

const promptCache = new Map<
  string,
  {
    expiresAt: number;
    value: unknown;
  }
>();

function readEnv(name: string) {
  return process.env[name]?.trim() || "";
}

function readPositiveIntegerEnv(name: string, fallback: number) {
  const parsed = Number.parseInt(readEnv(name), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function hasEnv(name: string) {
  return Boolean(readEnv(name));
}

function hasAnyNvidiaApiKey() {
  return NVIDIA_API_KEY_ENV_VARS.some((name) => hasEnv(name));
}

function normalizeBaseUrl(value: string, fallback: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  return trimmed.replace(/\/+$/, "");
}

function normalizeProviderModel(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed !== "auto" ? trimmed : null;
}

function normalizeOllamaModelName(value: string | null | undefined) {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }

  return trimmed.endsWith(":latest")
    ? trimmed.slice(0, -":latest".length)
    : trimmed;
}

function dedupeModelNames(models: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const model of models) {
    const trimmed = model.trim();
    const key = normalizeOllamaModelName(trimmed);
    if (!trimmed || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

export function extractOllamaModelNames(payload: unknown) {
  const record =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : null;
  const models = Array.isArray(record?.models) ? record.models : [];

  return dedupeModelNames(
    models
      .map((model) => {
        if (!model || typeof model !== "object" || Array.isArray(model)) {
          return "";
        }

        const item = model as Record<string, unknown>;
        return typeof item.name === "string"
          ? item.name
          : typeof item.model === "string"
            ? item.model
            : "";
      })
      .filter(Boolean)
  );
}

function resolveOllamaBaseUrl() {
  return normalizeBaseUrl(
    readEnv("OLLAMA_BASE_URL") || readEnv("LOCAL_AI_BASE_URL"),
    "http://127.0.0.1:11434/v1"
  );
}

function isLocalProviderEnabled(isDesktopApp?: boolean) {
  return (
    Boolean(isDesktopApp) ||
    readEnv("REARVY_ENABLE_LOCAL_AI") === "1" ||
    readEnv("OLLAMA_ENABLED") === "1" ||
    Boolean(readEnv("OLLAMA_BASE_URL") || readEnv("LOCAL_AI_BASE_URL"))
  );
}

function costAtOrBelow(costTier: ModelCostTier, maxCostTier: ModelCostTier) {
  return COST_RANK[costTier] <= COST_RANK[maxCostTier];
}

function getTaskDefaults(task: AIProviderTask | undefined) {
  return TASK_DEFAULTS[task ?? "chat_assistant"];
}

function getOpenRouterAttributionHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const appUrl =
    readEnv("OPENROUTER_HTTP_REFERER") ||
    readEnv("NEXT_PUBLIC_APP_URL") ||
    "https://www.rearvy.com";
  const appTitle = readEnv("OPENROUTER_APP_TITLE") || "Rearvy";

  if (appUrl) {
    headers["HTTP-Referer"] = appUrl;
  }
  if (appTitle) {
    headers["X-Title"] = appTitle;
  }

  return headers;
}

function getNvidiaApiKey(modelId?: string | null) {
  const modelKeyEnvVar = modelId?.trim()
    ? NVIDIA_MODEL_KEY_ENV_VARS[modelId.trim()]
    : undefined;

  return (modelKeyEnvVar ? readEnv(modelKeyEnvVar) : "") || readEnv("NVIDIA_API_KEY");
}

function getProviderApiKey(provider: ModelProviderConfig, modelId?: string | null) {
  if (!provider.keyEnvVar) {
    return "ollama";
  }

  if (provider.id === "nvidia") {
    return getNvidiaApiKey(modelId);
  }

  return readEnv(provider.keyEnvVar);
}

export function getProviderOptionsForModel(
  providerId: ModelProviderId | null | undefined,
  providerModel: string | null | undefined
): ProviderOptions | undefined {
  if (
    providerId === "nvidia" &&
    providerModel?.trim() === NVIDIA_DEEPSEEK_V4_PRO_MODEL
  ) {
    return {
      nvidia: {
        chat_template_kwargs: {
          thinking: false,
        },
      },
    };
  }

  return undefined;
}

function getProviderOptionsRecord(
  options: ProviderOptions | undefined,
  providerId: string
) {
  const value = options?.[providerId];
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseProviderSettings(value: unknown): AIProviderSettings | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  return {
    enabledProviders:
      record.enabledProviders && typeof record.enabledProviders === "object"
        ? (record.enabledProviders as AIProviderSettings["enabledProviders"])
        : undefined,
    providerPriority:
      record.providerPriority && typeof record.providerPriority === "object"
        ? (record.providerPriority as AIProviderSettings["providerPriority"])
        : undefined,
    providerModels:
      record.providerModels && typeof record.providerModels === "object"
        ? (record.providerModels as AIProviderSettings["providerModels"])
        : undefined,
    taskModels:
      record.taskModels && typeof record.taskModels === "object"
        ? (record.taskModels as AIProviderSettings["taskModels"])
        : undefined,
    allowPremium:
      typeof record.allowPremium === "boolean" ? record.allowPremium : undefined,
    maxCostTier:
      record.maxCostTier === "local" ||
      record.maxCostTier === "free" ||
      record.maxCostTier === "low" ||
      record.maxCostTier === "premium"
        ? record.maxCostTier
        : undefined,
    updatedAt:
      typeof record.updatedAt === "string"
        ? record.updatedAt
        : typeof record.updated_at === "string"
          ? record.updated_at
          : undefined,
  };
}

export async function loadAIProviderSettings(): Promise<AIProviderSettings | null> {
  if (settingsCache && Date.now() - settingsCache.loadedAt < SETTINGS_TTL_MS) {
    return settingsCache.settings;
  }

  try {
    const [{ adminDb }, { COLLECTIONS }] = await Promise.all([
      import("../firebase/admin"),
      import("../firebase/schema"),
    ]);
    const snapshot = await adminDb
      .collection(COLLECTIONS.AI_PROVIDER_SETTINGS)
      .doc(ROUTER_SETTINGS_DOC_ID)
      .get();
    const settings = parseProviderSettings(snapshot.data());
    settingsCache = { loadedAt: Date.now(), settings };
    return settings;
  } catch (error) {
    log.warn("AI provider settings unavailable; using env defaults.", error);
    settingsCache = { loadedAt: Date.now(), settings: null };
    return null;
  }
}

function applyProviderSettings(
  providers: ModelProviderConfig[],
  settings: AIProviderSettings | null | undefined
) {
  if (!settings) {
    return providers;
  }

  return providers.map((provider) => {
    const enabledOverride = settings.enabledProviders?.[provider.id];
    const priorityOverride = settings.providerPriority?.[provider.id];
    const modelOverride = settings.providerModels?.[provider.id]?.trim();
    const taskModelOverrides = Object.fromEntries(
      Object.entries(settings.taskModels ?? {}).flatMap(([task, providerModels]) => {
        const model = providerModels?.[provider.id]?.trim();
        return model ? [[task, model]] : [];
      })
    ) as Partial<Record<AIProviderTask, string>>;

    return {
      ...provider,
      enabled:
        typeof enabledOverride === "boolean"
          ? enabledOverride && provider.configured
          : provider.enabled,
      priority:
        typeof priorityOverride === "number" && Number.isFinite(priorityOverride)
          ? priorityOverride
          : provider.priority,
      defaultModel: modelOverride || provider.defaultModel,
      taskModels: {
        ...provider.taskModels,
        ...taskModelOverrides,
      },
    };
  });
}

export function buildModelProviderConfigs(
  options: {
    isDesktopApp?: boolean;
    localHealth?: ModelProviderHealth;
    providerHealth?: Partial<Record<ModelProviderId, ModelProviderHealth>>;
    settings?: AIProviderSettings | null;
  } = {}
): ModelProviderConfig[] {
  const localEnabled = isLocalProviderEnabled(options.isDesktopApp);
  const localVisionModel = readEnv("OLLAMA_VISION_MODEL") || undefined;
  const openRouterModel =
    readEnv("OPENROUTER_CHAT_MODEL") ||
    readEnv("OPENROUTER_FREE_MODEL") ||
    OPENROUTER_FREE_MODELS[0];

  const providers: ModelProviderConfig[] = [
    {
      id: "local_ollama",
      name: "Ollama local",
      baseUrl: resolveOllamaBaseUrl(),
      keyEnvVar: null,
      defaultModel:
        readEnv("OLLAMA_CHAT_MODEL") ||
        readEnv("LOCAL_AI_CHAT_MODEL") ||
        "llama3.1:8b",
      taskModels: {
        memory_tagging:
          readEnv("OLLAMA_MEMORY_MODEL") ||
          readEnv("OLLAMA_CHAT_MODEL") ||
          readEnv("LOCAL_AI_CHAT_MODEL") ||
          "llama3.1:8b",
        route_selection:
          readEnv("OLLAMA_ROUTER_MODEL") ||
          readEnv("OLLAMA_CHAT_MODEL") ||
          readEnv("LOCAL_AI_CHAT_MODEL") ||
          "llama3.1:8b",
      },
      visionModel: localVisionModel,
      capabilities: localVisionModel
        ? ["chat", "vision", "json"]
        : ["chat", "json"],
      costTier: "local",
      configured: localEnabled,
      enabled: localEnabled,
      priority: 10,
      health: options.localHealth ?? options.providerHealth?.local_ollama,
      supportsStructuredOutputs: true,
    },
    {
      id: "openrouter",
      name: "OpenRouter free/open-source",
      baseUrl: normalizeBaseUrl(readEnv("OPENROUTER_BASE_URL"), OPENROUTER_BASE_URL),
      keyEnvVar: "OPENROUTER_API_KEY",
      defaultModel: openRouterModel,
      taskModels: {
        chat_assistant: openRouterModel,
        summary:
          readEnv("OPENROUTER_SUMMARY_MODEL") ||
          "meta-llama/llama-3.2-3b-instruct:free",
        email_draft:
          readEnv("OPENROUTER_EMAIL_MODEL") ||
          "google/gemma-4-31b-it:free",
        json_classification:
          readEnv("OPENROUTER_JSON_MODEL") ||
          "qwen/qwen3-next-80b-a3b-instruct:free",
        route_selection:
          readEnv("OPENROUTER_ROUTER_MODEL") ||
          readEnv("OPENROUTER_JSON_MODEL") ||
          "meta-llama/llama-3.2-3b-instruct:free",
        analytics_explanation:
          readEnv("OPENROUTER_ANALYTICS_MODEL") ||
          "deepseek/deepseek-v4-flash:free",
        deep_business_reasoning:
          readEnv("OPENROUTER_REASONING_MODEL") ||
          "qwen/qwen3-next-80b-a3b-instruct:free",
        workflow_reasoning:
          readEnv("OPENROUTER_WORKFLOW_MODEL") ||
          "qwen/qwen3-next-80b-a3b-instruct:free",
      },
      capabilities: ["chat", "tools", "json"],
      costTier: "free",
      configured: hasEnv("OPENROUTER_API_KEY"),
      enabled: hasEnv("OPENROUTER_API_KEY"),
      priority: 20,
      health: options.providerHealth?.openrouter,
      includeUsage: true,
      supportsStructuredOutputs: true,
      supportsResponseCache: true,
      attributionHeaders: getOpenRouterAttributionHeaders(),
    },
    {
      id: "nvidia",
      name: "NVIDIA free inference",
      baseUrl: NVIDIA_BASE_URL,
      keyEnvVar: "NVIDIA_API_KEY",
      defaultModel:
        readEnv("NVIDIA_CHAT_MODEL") || NVIDIA_KIMI_K2_6_MODEL,
      taskModels: {
        summary:
          readEnv("NVIDIA_SUMMARY_MODEL") ||
          NVIDIA_KIMI_K2_6_MODEL,
        email_draft:
          readEnv("NVIDIA_EMAIL_MODEL") || NVIDIA_KIMI_K2_6_MODEL,
        json_classification:
          readEnv("NVIDIA_JSON_MODEL") ||
          NVIDIA_STEP_3_7_FLASH_MODEL,
        route_selection:
          readEnv("NVIDIA_ROUTER_MODEL") || NVIDIA_STEP_3_7_FLASH_MODEL,
        analytics_explanation:
          readEnv("NVIDIA_ANALYTICS_MODEL") || NVIDIA_KIMI_K2_6_MODEL,
        deep_business_reasoning:
          readEnv("NVIDIA_REASONING_MODEL") ||
          NVIDIA_KIMI_K2_6_MODEL,
        workflow_reasoning:
          readEnv("NVIDIA_WORKFLOW_MODEL") ||
          NVIDIA_KIMI_K2_6_MODEL,
      },
      visionModel:
        readEnv("NVIDIA_VISION_MODEL") || NVIDIA_LLAMA_VISION_MODEL,
      capabilities: ["chat", "vision", "json"],
      costTier: "free",
      configured: hasAnyNvidiaApiKey(),
      enabled: hasAnyNvidiaApiKey(),
      priority: 30,
      health: options.providerHealth?.nvidia,
      supportsStructuredOutputs: true,
    },
    {
      id: "groq",
      name: "Groq open-source cloud",
      baseUrl: normalizeBaseUrl(readEnv("GROQ_BASE_URL"), GROQ_BASE_URL),
      keyEnvVar: "GROQ_API_KEY",
      defaultModel: readEnv("GROQ_CHAT_MODEL") || "llama-3.1-8b-instant",
      taskModels: {
        summary: readEnv("GROQ_SUMMARY_MODEL") || "llama-3.1-8b-instant",
        email_draft: readEnv("GROQ_EMAIL_MODEL") || "llama-3.1-8b-instant",
        route_selection:
          readEnv("GROQ_ROUTER_MODEL") || "llama-3.1-8b-instant",
      },
      capabilities: ["chat", "json"],
      costTier: "low",
      configured: hasEnv("GROQ_API_KEY"),
      enabled: hasEnv("GROQ_API_KEY"),
      priority: 40,
      health: options.providerHealth?.groq,
      supportsStructuredOutputs: true,
    },
    {
      id: "together",
      name: "Together open-source cloud",
      baseUrl: normalizeBaseUrl(readEnv("TOGETHER_BASE_URL"), TOGETHER_BASE_URL),
      keyEnvVar: "TOGETHER_API_KEY",
      defaultModel:
        readEnv("TOGETHER_CHAT_MODEL") ||
        "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
      taskModels: {
        route_selection:
          readEnv("TOGETHER_ROUTER_MODEL") ||
          readEnv("TOGETHER_CHAT_MODEL") ||
          "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
      },
      capabilities: ["chat", "json"],
      costTier: "low",
      configured: hasEnv("TOGETHER_API_KEY"),
      enabled: hasEnv("TOGETHER_API_KEY"),
      priority: 45,
      health: options.providerHealth?.together,
      supportsStructuredOutputs: true,
    },
    {
      id: "openai",
      name: "Premium API",
      baseUrl: normalizeBaseUrl(readEnv("OPENAI_BASE_URL"), OPENAI_BASE_URL),
      keyEnvVar: "OPENAI_API_KEY",
      defaultModel: readEnv("OPENAI_CHAT_MODEL") || "gpt-4o-mini",
      visionModel: readEnv("OPENAI_VISION_MODEL") || readEnv("OPENAI_CHAT_MODEL"),
      taskModels: {
        route_selection:
          readEnv("OPENAI_ROUTER_MODEL") ||
          readEnv("OPENAI_CHAT_MODEL") ||
          "gpt-4o-mini",
      },
      capabilities: ["chat", "vision", "tools", "json"],
      costTier: "premium",
      configured: hasEnv("OPENAI_API_KEY"),
      enabled: hasEnv("OPENAI_API_KEY"),
      priority: 80,
      health: options.providerHealth?.openai,
      includeUsage: true,
      supportsStructuredOutputs: true,
    },
  ];

  return applyProviderSettings(providers, options.settings);
}

function providerSupportsRequest(
  provider: ModelProviderConfig,
  options: ModelRouteOptions
) {
  if (!provider.enabled || !provider.configured) {
    return false;
  }

  if (
    provider.health?.status === "unreachable" ||
    provider.health?.status === "rate_limited"
  ) {
    return false;
  }

  if (provider.id === "local_ollama" && options.allowLocal === false) {
    return false;
  }

  if (
    provider.costTier === "premium" &&
    options.allowPremium !== true &&
    options.maxCostTier !== "premium"
  ) {
    return false;
  }

  const taskDefaults = getTaskDefaults(options.task);
  const maxCostTier = options.maxCostTier ?? taskDefaults.maxCostTier;
  if (!costAtOrBelow(provider.costTier, maxCostTier)) {
    return false;
  }

  const requiredCapabilities = [
    ...(options.requiredCapabilities ?? taskDefaults.requiredCapabilities),
  ];

  if (options.hasImageInput && !requiredCapabilities.includes("vision")) {
    requiredCapabilities.push("vision");
  }

  return requiredCapabilities.every((capability) =>
    provider.capabilities.includes(capability)
  );
}

function selectProviderModel(
  provider: ModelProviderConfig,
  options: ModelRouteOptions
) {
  const requestedProviderModel = normalizeProviderModel(
    options.requestedProviderModel
  );

  if (options.hasImageInput && provider.visionModel) {
    return provider.visionModel;
  }

  if (requestedProviderModel) {
    if (provider.id === "local_ollama" && options.providerId === "local_ollama") {
      return requestedProviderModel;
    }

    if (provider.id === "nvidia") {
      return requestedProviderModel;
    }

    if (
      provider.id === "openrouter" &&
      (requestedProviderModel.includes(":free") ||
        requestedProviderModel.startsWith("openrouter/") ||
        requestedProviderModel.startsWith("deepseek/") ||
        requestedProviderModel.startsWith("qwen/") ||
        requestedProviderModel.startsWith("meta-llama/") ||
        requestedProviderModel.startsWith("google/") ||
        requestedProviderModel.startsWith("mistral"))
    ) {
      return normalizeOpenRouterModelId(requestedProviderModel);
    }
  }

  const providerModel =
    provider.taskModels?.[options.task ?? "chat_assistant"] ||
    provider.defaultModel;
  return provider.id === "openrouter"
    ? normalizeOpenRouterModelId(providerModel)
    : providerModel;
}

function normalizeOpenRouterModelId(model: string) {
  return OPENROUTER_MODEL_ALIASES[model] ?? model;
}

function isLikelyNonChatOllamaModel(model: string) {
  const normalized = normalizeOllamaModelName(model);
  return (
    normalized.includes("embed") ||
    normalized.includes("embedding") ||
    normalized.includes("bge-") ||
    normalized.includes("nomic-") ||
    normalized.includes("minilm") ||
    normalized.includes("e5-")
  );
}

function isLikelyVisionOllamaModel(model: string) {
  const normalized = normalizeOllamaModelName(model);
  return (
    normalized.includes("llava") ||
    normalized.includes("vision") ||
    normalized.includes("bakllava") ||
    normalized.includes("moondream") ||
    normalized.includes("minicpm-v")
  );
}

function isLikelyChatOllamaModel(model: string) {
  const normalized = normalizeOllamaModelName(model);
  return (
    normalized.includes("llama") ||
    normalized.includes("mistral") ||
    normalized.includes("mixtral") ||
    normalized.includes("qwen") ||
    normalized.includes("gemma") ||
    normalized.includes("deepseek") ||
    normalized.includes("phi") ||
    normalized.includes("codellama") ||
    normalized.includes("smollm") ||
    normalized.includes("starcoder")
  );
}

function findInstalledOllamaModel(
  availableModels: string[],
  requestedModel: string
) {
  const normalizedRequestedModel = normalizeOllamaModelName(requestedModel);

  return availableModels.find(
    (model) => normalizeOllamaModelName(model) === normalizedRequestedModel
  );
}

function chooseInstalledOllamaFallbackModel(
  availableModels: string[],
  options: ModelRouteOptions
) {
  const eligibleModels = dedupeModelNames(availableModels).filter(
    (model) => !isLikelyNonChatOllamaModel(model)
  );

  if (options.hasImageInput || options.task === "screen_analysis") {
    return eligibleModels.find(isLikelyVisionOllamaModel) ?? null;
  }

  return eligibleModels.find(isLikelyChatOllamaModel) ?? eligibleModels[0] ?? null;
}

function resolveAvailableLocalProviderModel(
  provider: ModelProviderConfig,
  providerModel: string,
  options: ModelRouteOptions
) {
  if (provider.id !== "local_ollama") {
    return providerModel;
  }

  const availableModels = provider.health?.availableModels;
  if (!availableModels) {
    return providerModel;
  }

  const installedModel = findInstalledOllamaModel(availableModels, providerModel);
  if (installedModel) {
    return installedModel;
  }

  const explicitlyTestingLocalModel =
    options.providerId === "local_ollama" &&
    normalizeProviderModel(options.requestedProviderModel) === providerModel;
  if (explicitlyTestingLocalModel) {
    return null;
  }

  return chooseInstalledOllamaFallbackModel(availableModels, options);
}

function getProviderQualityScore(
  provider: ModelProviderConfig,
  options: ModelRouteOptions
) {
  const providerScore: Record<ModelProviderId, number> = {
    local_ollama: 25,
    openrouter: 50,
    groq: 45,
    together: 50,
    nvidia: 85,
    openai: 90,
  };
  let score = providerScore[provider.id] + COST_RANK[provider.costTier] * 8;
  const selectedModel = selectProviderModel(provider, options).toLowerCase();

  if (
    selectedModel.includes("nemotron") ||
    selectedModel.includes("deepseek-v4-pro") ||
    selectedModel.includes("glm-5.1")
  ) {
    score += 35;
  }

  if (
    (options.task === "deep_business_reasoning" ||
      options.task === "workflow_reasoning") &&
    selectedModel.includes("nemotron")
  ) {
    score += 30;
  }

  if (
    selectedModel.includes("instant") ||
    selectedModel.includes("flash") ||
    selectedModel.includes("3b") ||
    selectedModel.includes("8b")
  ) {
    score -= 15;
  }

  if (provider.health?.status === "available") {
    score += 5;
  }

  return score;
}

function compareRouteProviders(
  left: ModelProviderConfig,
  right: ModelProviderConfig,
  options: ModelRouteOptions
) {
  if (options.routingMode === "quality") {
    const scoreDifference =
      getProviderQualityScore(right, options) -
      getProviderQualityScore(left, options);
    if (scoreDifference !== 0) {
      return scoreDifference;
    }
  }

  const leftLatency = left.health?.latencyMs;
  const rightLatency = right.health?.latencyMs;
  if (
    options.routingMode !== "quality" &&
    typeof leftLatency === "number" &&
    typeof rightLatency === "number" &&
    Math.abs(leftLatency - rightLatency) > 50
  ) {
    return leftLatency - rightLatency;
  }

  return left.priority - right.priority;
}

function buildDecision(params: {
  provider: ModelProviderConfig | null;
  providerModel: string | null;
  options: ModelRouteOptions;
  fallbacksTried: string[];
  unavailableReason?: string | null;
  reason?: string;
}) {
  const now = params.options.now ?? new Date();
  const task = params.options.task ?? "chat_assistant";
  const taskDefaults = getTaskDefaults(task);
  const requiredCapabilities = [
    ...(params.options.requiredCapabilities ?? taskDefaults.requiredCapabilities),
  ];

  if (params.options.hasImageInput && !requiredCapabilities.includes("vision")) {
    requiredCapabilities.push("vision");
  }

  const routingReason = params.options.routing
    ? `${params.options.routingMode === "quality" ? "Quality" : "Fast"} router chose ${task}${
        params.options.routing.reason ? `: ${params.options.routing.reason}` : ""
      }.`
    : null;

  return {
    providerId: params.provider?.id ?? null,
    providerName: params.provider?.name ?? null,
    providerModel: params.providerModel,
    costTier: params.provider?.costTier ?? null,
    baseUrl: params.provider?.baseUrl ?? null,
    reason:
      params.reason ??
      (routingReason && params.provider
        ? `${routingReason} Selected ${params.provider.name} for the final answer.`
        : params.provider?.id === "local_ollama"
        ? "Selected local inference to keep free-tier cost near zero."
        : params.provider
          ? `Selected ${params.provider.name} for ${task}: ${taskDefaults.description}`
          : "No configured model provider is currently available."),
    requestedModel: normalizeProviderModel(params.options.requestedProviderModel),
    task,
    requiredCapabilities,
    localPreferred: params.options.allowLocal !== false,
    fallbacksTried: params.fallbacksTried,
    fallbackFailures: params.options.fallbackFailures ?? [],
    unavailableReason: params.unavailableReason ?? null,
    capabilities: params.provider?.capabilities ?? [],
    cacheStatus: "bypass" as const,
    routingMode: params.options.routingMode ?? "fast",
    routing: params.options.routing ?? null,
    selectedAt: now.toISOString(),
  } satisfies ModelRouteDecision;
}

export function selectModelRouteCandidate(
  providers: ModelProviderConfig[],
  options: ModelRouteOptions = {}
): {
  provider: ModelProviderConfig | null;
  providerModel: string | null;
  decision: ModelRouteDecision;
} {
  const excluded = new Set(options.excludeProviderIds ?? []);
  const orderedProviders = [...providers].sort((left, right) =>
    compareRouteProviders(left, right, options)
  );
  const fallbacksTried: string[] = [];

  for (const provider of orderedProviders) {
    if (options.providerId && provider.id !== options.providerId) {
      continue;
    }

    if (excluded.has(provider.id) || !providerSupportsRequest(provider, options)) {
      fallbacksTried.push(provider.id);
      continue;
    }

    const providerModel = selectProviderModel(provider, options);
    const availableProviderModel = resolveAvailableLocalProviderModel(
      provider,
      providerModel,
      options
    );
    if (!availableProviderModel) {
      fallbacksTried.push(provider.id);
      continue;
    }

    return {
      provider,
      providerModel: availableProviderModel,
      decision: buildDecision({
        provider,
        providerModel: availableProviderModel,
        options,
        fallbacksTried,
      }),
    };
  }

  return {
    provider: null,
    providerModel: null,
    decision: buildDecision({
      provider: null,
      providerModel: null,
      options,
      fallbacksTried,
      unavailableReason:
        "Enable Ollama/local AI, configure OPENROUTER_API_KEY or NVIDIA_API_KEY, or add an optional provider key.",
    }),
  };
}

export class ProviderHealthManager {
  private health = new Map<ModelProviderId, ModelProviderHealth>();

  get(providerId: ModelProviderId) {
    const cached = this.health.get(providerId);
    if (!cached) {
      return undefined;
    }

    if (Date.now() - new Date(cached.checkedAt).getTime() > HEALTH_TTL_MS) {
      return undefined;
    }

    return cached;
  }

  getAll(): Partial<Record<ModelProviderId, ModelProviderHealth>> {
    const result: Partial<Record<ModelProviderId, ModelProviderHealth>> = {};
    for (const providerId of this.health.keys()) {
      const value = this.get(providerId);
      if (value) {
        result[providerId] = value;
      }
    }
    return result;
  }

  markSuccess(providerId: ModelProviderId, latencyMs?: number) {
    this.health.set(providerId, {
      status: "available",
      checkedAt: new Date().toISOString(),
      latencyMs,
      reason: "Provider responded successfully.",
    });
  }

  markFailure(
    providerId: ModelProviderId,
    reason: string,
    options: { rateLimited?: boolean; timeout?: boolean; retryAfterMs?: number } = {}
  ) {
    const previous = this.health.get(providerId);
    const now = new Date();
    this.health.set(providerId, {
      status: options.rateLimited ? "rate_limited" : "unreachable",
      checkedAt: now.toISOString(),
      reason,
      rateLimitResetAt: options.retryAfterMs
        ? new Date(now.getTime() + options.retryAfterMs).toISOString()
        : null,
      failureCount: (previous?.failureCount ?? 0) + 1,
      timeoutCount: (previous?.timeoutCount ?? 0) + (options.timeout ? 1 : 0),
    });
  }
}

export const providerHealthManager = new ProviderHealthManager();

export class AIProviderRouter {
  constructor(private readonly healthManager = providerHealthManager) {}

  async getProviders(options: { isDesktopApp?: boolean } = {}) {
    const localEnabled = isLocalProviderEnabled(options.isDesktopApp);
    const [localHealth, settings] = await Promise.all([
      localEnabled ? checkLocalOllamaHealth(resolveOllamaBaseUrl()) : undefined,
      loadAIProviderSettings(),
    ]);

    return buildModelProviderConfigs({
      isDesktopApp: options.isDesktopApp,
      localHealth,
      providerHealth: this.healthManager.getAll(),
      settings,
    });
  }

  async selectRoute(options: ResolveModelForChatOptions = {}) {
    const settings = await loadAIProviderSettings();
    const providers = await this.getProviders({ isDesktopApp: options.isDesktopApp });
    return selectModelRouteCandidate(providers, {
      requestedProviderModel: options.requestedProviderModel,
      providerId: options.providerId,
      task: options.task,
      hasImageInput: options.hasImageInput,
      allowLocal: true,
      allowPremium: options.allowPremium ?? settings?.allowPremium,
      maxCostTier:
        options.maxCostTier ??
        settings?.maxCostTier ??
        getTaskDefaults(options.task).maxCostTier,
      requiredCapabilities: options.requiredCapabilities,
      routingMode: options.routingMode,
      routing: options.routing,
    });
  }
}

export const aiProviderRouter = new AIProviderRouter();

function createProviderLanguageModel(providerConfig: ModelProviderConfig, modelId: string) {
  const provider = createOpenAICompatible({
    name: providerConfig.id,
    baseURL: providerConfig.baseUrl,
    apiKey: getProviderApiKey(providerConfig, modelId),
    includeUsage: providerConfig.includeUsage,
    supportsStructuredOutputs: providerConfig.supportsStructuredOutputs,
    headers: providerConfig.attributionHeaders,
  });

  return provider.chatModel(modelId);
}

function getErrorStatusCode(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const record = error as Record<string, unknown>;
  const candidates = [
    record.statusCode,
    record.status,
    record.response && typeof record.response === "object"
      ? (record.response as Record<string, unknown>).status
      : undefined,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }

  return null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isRetryableAIError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  const statusCode = getErrorStatusCode(error);

  if (
    statusCode === 408 ||
    statusCode === 429 ||
    (typeof statusCode === "number" && statusCode >= 500)
  ) {
    return true;
  }

  if (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("rate limit") ||
    message.includes("429") ||
    message.includes("econnreset") ||
    message.includes("fetch failed") ||
    message.includes("network")
  ) {
    return true;
  }

  return false;
}

function createFailureRecord(
  provider: ModelProviderConfig,
  providerModel: string | null,
  error: unknown
): ProviderFailureRecord {
  const statusCode = getErrorStatusCode(error);
  return {
    providerId: provider.id,
    providerModel,
    reason: getErrorMessage(error).slice(0, 500),
    retryable: isRetryableAIError(error),
    statusCode,
    failedAt: new Date().toISOString(),
  };
}

function createCacheKey(request: CompletionBaseRequest) {
  const payload = JSON.stringify({
    task: request.task ?? "chat_assistant",
    system: request.system ?? "",
    prompt: request.prompt ?? "",
    messages: request.messages ?? [],
    projectId: request.projectId ?? null,
    userId: request.userId ?? null,
  });

  return createHash("sha256").update(payload).digest("hex");
}

function prunePromptCache() {
  const now = Date.now();
  for (const [key, entry] of promptCache.entries()) {
    if (entry.expiresAt <= now) {
      promptCache.delete(key);
    }
  }

  while (promptCache.size > PROMPT_CACHE_MAX_ENTRIES) {
    const firstKey = promptCache.keys().next().value as string | undefined;
    if (!firstKey) {
      break;
    }
    promptCache.delete(firstKey);
  }
}

async function recordAIProviderEvent(payload: Record<string, unknown>) {
  try {
    const [{ adminDb }, { COLLECTIONS }] = await Promise.all([
      import("../firebase/admin"),
      import("../firebase/schema"),
    ]);
    await adminDb.collection(COLLECTIONS.AI_PROVIDER_EVENTS).add(
      sanitizeFirestoreDocumentData({
        ...payload,
        created_at: new Date().toISOString(),
      })
    );
  } catch (error) {
    log.warn("Failed to record AI provider event:", error);
  }
}

async function recordAIUsageEvent(payload: Record<string, unknown>) {
  try {
    const [{ adminDb }, { COLLECTIONS }] = await Promise.all([
      import("../firebase/admin"),
      import("../firebase/schema"),
    ]);
    await adminDb.collection(COLLECTIONS.AI_USAGE_EVENTS).add(
      sanitizeFirestoreDocumentData({
        ...payload,
        created_at: new Date().toISOString(),
      })
    );
  } catch (error) {
    log.warn("Failed to record AI usage event:", error);
  }
}

export function sanitizeFirestoreDocumentData(
  value: Record<string, unknown>
): Record<string, unknown> {
  const sanitized = sanitizeFirestoreValue(value);
  return sanitized && typeof sanitized === "object" && !Array.isArray(sanitized)
    ? (sanitized as Record<string, unknown>)
    : {};
}

function sanitizeFirestoreValue(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  if (value instanceof Date) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => {
      const sanitized = sanitizeFirestoreValue(item);
      return sanitized === undefined ? null : sanitized;
    });
  }

  const output: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    const sanitized = sanitizeFirestoreValue(nestedValue);
    if (sanitized !== undefined) {
      output[key] = sanitized;
    }
  }
  return output;
}

function extractUsage(result: unknown) {
  if (!result || typeof result !== "object") {
    return null;
  }

  const usage = (result as Record<string, unknown>).usage;
  return usage && typeof usage === "object"
    ? (usage as Record<string, unknown>)
    : null;
}

function buildHeaders(
  provider: ModelProviderConfig,
  request: CompletionBaseRequest
) {
  if (provider.id !== "openrouter" || !request.cache) {
    return undefined;
  }

  return {
    "X-OpenRouter-Cache": "true",
  };
}

export function isNvidiaNemotronReasoningModel(
  model: string | null | undefined
) {
  const normalizedModel = normalizeProviderModel(model);
  return normalizedModel
    ? NVIDIA_NEMOTRON_REASONING_MODELS.has(normalizedModel)
    : false;
}

export function buildProviderOptionsForRoute(params: {
  providerId: ModelProviderId | null | undefined;
  providerModel: string | null | undefined;
  enableReasoning?: boolean;
  reasoningBudget?: number;
}): ProviderOptions | undefined {
  const providerOptions = getProviderOptionsForModel(
    params.providerId,
    params.providerModel
  );

  if (
    params.providerId !== "nvidia" ||
    !params.enableReasoning ||
    !isNvidiaNemotronReasoningModel(params.providerModel)
  ) {
    return providerOptions;
  }

  const reasoningBudget =
    params.reasoningBudget ??
    readPositiveIntegerEnv("NVIDIA_REASONING_BUDGET", 16384);
  const nvidiaOptions = getProviderOptionsRecord(providerOptions, "nvidia");
  const chatTemplateOptions =
    nvidiaOptions.chat_template_kwargs &&
    typeof nvidiaOptions.chat_template_kwargs === "object" &&
    !Array.isArray(nvidiaOptions.chat_template_kwargs)
      ? (nvidiaOptions.chat_template_kwargs as Record<string, unknown>)
      : {};

  return {
    ...providerOptions,
    nvidia: {
      ...nvidiaOptions,
      chat_template_kwargs: {
        ...chatTemplateOptions,
        enable_thinking: true,
      },
      reasoning_budget: reasoningBudget,
    },
  };
}

export class AICompletionService {
  constructor(
    private readonly router = aiProviderRouter,
    private readonly healthManager = providerHealthManager
  ) {}

  private async resolveAttempt(
    request: CompletionBaseRequest,
    failures: ProviderFailureRecord[]
  ) {
    const providers = await this.router.getProviders({
      isDesktopApp: request.isDesktopApp,
    });
    const settings = await loadAIProviderSettings();
    return selectModelRouteCandidate(providers, {
      requestedProviderModel: request.requestedProviderModel,
      providerId: request.providerId,
      task: request.task,
      hasImageInput: request.hasImageInput,
      allowLocal: request.allowLocal ?? true,
      allowPremium: request.allowPremium ?? settings?.allowPremium,
      maxCostTier:
        request.maxCostTier ??
        settings?.maxCostTier ??
        getTaskDefaults(request.task).maxCostTier,
      excludeProviderIds: failures.map((failure) => failure.providerId),
      fallbackFailures: failures,
      routingMode: request.routingMode,
    });
  }

  async generateText(
    request: GenerateTextRequest
  ): Promise<AITextResult> {
    const cacheKey = request.cache ? createCacheKey(request) : null;
    if (cacheKey) {
      prunePromptCache();
      const cached = promptCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.value as AITextResult;
      }
    }

    const failures: ProviderFailureRecord[] = [];

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const route = await this.resolveAttempt(request, failures);
      if (!route.provider || !route.providerModel) {
        return {
          text: buildNoModelConfiguredMessage(),
          finishReason: "stop",
          modelRoute: route.decision,
          aiUnavailable: true,
        };
      }

      const model = createProviderLanguageModel(route.provider, route.providerModel);
      const startedAt = Date.now();
      const controller = request.timeoutMs ? new AbortController() : null;
      const timeout = controller
        ? setTimeout(() => controller.abort(), request.timeoutMs)
        : null;

      try {
        const result = await aiGenerateText({
          model,
          system: request.system,
          prompt: request.prompt,
          messages: request.messages as never,
          maxOutputTokens: request.maxOutputTokens,
          temperature: request.temperature,
          headers: buildHeaders(route.provider, request),
          providerOptions: buildProviderOptionsForRoute({
            providerId: route.provider.id,
            providerModel: route.providerModel,
            enableReasoning: request.enableProviderReasoning,
            reasoningBudget: request.reasoningBudget,
          }),
          abortSignal: request.abortSignal ?? controller?.signal,
        });
        const latencyMs = Date.now() - startedAt;
        const usage = extractUsage(result);
        this.healthManager.markSuccess(route.provider.id, latencyMs);
        route.decision.latencyMs = latencyMs;
        route.decision.usage = usage;
        route.decision.cacheStatus = cacheKey ? "miss" : "bypass";

        void recordAIUsageEvent({
          user_id: request.userId ?? null,
          project_id: request.projectId ?? null,
          chat_id: request.chatId ?? null,
          task: route.decision.task,
          provider_id: route.provider.id,
          provider_model: route.providerModel,
          cost_tier: route.provider.costTier,
          latency_ms: latencyMs,
          usage,
          route: route.decision,
        });

        const finalResult = {
          ...result,
          modelRoute: route.decision,
        } as AITextResult;
        if (cacheKey) {
          promptCache.set(cacheKey, {
            expiresAt: Date.now() + PROMPT_CACHE_TTL_MS,
            value: finalResult,
          });
        }
        return finalResult;
      } catch (error) {
        const failure = createFailureRecord(
          route.provider,
          route.providerModel,
          error
        );
        failures.push(failure);
        this.healthManager.markFailure(route.provider.id, failure.reason, {
          rateLimited: failure.statusCode === 429,
          timeout: failure.reason.toLowerCase().includes("timeout"),
        });
        void recordAIProviderEvent({
          user_id: request.userId ?? null,
          project_id: request.projectId ?? null,
          chat_id: request.chatId ?? null,
          task: route.decision.task,
          type: "provider_failure",
          provider_id: route.provider.id,
          provider_model: route.providerModel,
          retryable: failure.retryable,
          status_code: failure.statusCode ?? null,
          reason: failure.reason,
          route: route.decision,
        });

        if (!failure.retryable) {
          throw error;
        }
      } finally {
        if (timeout) {
          clearTimeout(timeout);
        }
      }
    }

    return {
      text: buildNoModelConfiguredMessage(),
      finishReason: "stop",
      modelRoute: buildDecision({
        provider: null,
        providerModel: null,
        options: {
          task: request.task,
          providerId: request.providerId,
          requestedProviderModel: request.requestedProviderModel,
          fallbackFailures: failures,
        },
        fallbacksTried: failures.map((failure) => failure.providerId),
        unavailableReason: "All configured AI providers failed or were rate limited.",
      }),
      aiUnavailable: true,
    };
  }

  async generateObject<TSchema extends z.ZodTypeAny>(
    request: GenerateObjectRequest<TSchema>
  ): Promise<AIObjectResult<z.infer<TSchema>>> {
    const failures: ProviderFailureRecord[] = [];

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const route = await this.resolveAttempt(
        {
          ...request,
          task: request.task ?? "json_classification",
        },
        failures
      );
      if (!route.provider || !route.providerModel) {
        throw new Error(route.decision.unavailableReason ?? route.decision.reason);
      }

      const model = createProviderLanguageModel(route.provider, route.providerModel);
      const startedAt = Date.now();

      try {
        const result = await aiGenerateObject({
          model,
          schema: request.schema,
          system: request.system,
          prompt: request.prompt,
          messages: request.messages as never,
          maxOutputTokens: request.maxOutputTokens,
          temperature: request.temperature,
          headers: buildHeaders(route.provider, request),
          providerOptions: buildProviderOptionsForRoute({
            providerId: route.provider.id,
            providerModel: route.providerModel,
            enableReasoning: request.enableProviderReasoning,
            reasoningBudget: request.reasoningBudget,
          }),
        });
        const latencyMs = Date.now() - startedAt;
        const usage = extractUsage(result);
        this.healthManager.markSuccess(route.provider.id, latencyMs);
        route.decision.latencyMs = latencyMs;
        route.decision.usage = usage;

        void recordAIUsageEvent({
          user_id: request.userId ?? null,
          project_id: request.projectId ?? null,
          chat_id: request.chatId ?? null,
          task: route.decision.task,
          provider_id: route.provider.id,
          provider_model: route.providerModel,
          cost_tier: route.provider.costTier,
          latency_ms: latencyMs,
          usage,
          route: route.decision,
        });

        return {
          ...result,
          modelRoute: route.decision,
        } as AIObjectResult<z.infer<TSchema>>;
      } catch (error) {
        const failure = createFailureRecord(
          route.provider,
          route.providerModel,
          error
        );
        failures.push(failure);
        this.healthManager.markFailure(route.provider.id, failure.reason, {
          rateLimited: failure.statusCode === 429,
          timeout: failure.reason.toLowerCase().includes("timeout"),
        });
        void recordAIProviderEvent({
          user_id: request.userId ?? null,
          project_id: request.projectId ?? null,
          chat_id: request.chatId ?? null,
          task: route.decision.task,
          type: "provider_failure",
          provider_id: route.provider.id,
          provider_model: route.providerModel,
          retryable: failure.retryable,
          status_code: failure.statusCode ?? null,
          reason: failure.reason,
          route: route.decision,
        });

        if (!failure.retryable) {
          throw error;
        }
      }
    }

    throw new Error("All configured AI providers failed or were rate limited.");
  }

  async streamText(
    request: StreamTextRequest
  ): Promise<{
    result: AIStreamTextResult;
    modelRoute: ModelRouteDecision;
    provider: ModelProviderConfig | null;
  }> {
    const route = await this.resolveAttempt(request, []);
    if (!route.provider || !route.providerModel) {
      throw new Error(route.decision.unavailableReason ?? route.decision.reason);
    }

    const model = createProviderLanguageModel(route.provider, route.providerModel);
    const startedAt = Date.now();
    const result = aiStreamText({
      model,
      system: request.system,
      prompt: request.prompt,
      messages: request.messages as never,
      maxOutputTokens: request.maxOutputTokens,
      temperature: request.temperature,
      tools: request.tools as never,
      stopWhen: request.stopWhen as never,
      prepareStep: request.prepareStep as never,
      headers: buildHeaders(route.provider, request),
      providerOptions: buildProviderOptionsForRoute({
        providerId: route.provider.id,
        providerModel: route.providerModel,
        enableReasoning: request.enableProviderReasoning,
        reasoningBudget: request.reasoningBudget,
      }),
      onFinish: async (event) => {
        const latencyMs = Date.now() - startedAt;
        const usage = extractUsage(event);
        this.healthManager.markSuccess(route.provider!.id, latencyMs);
        route.decision.latencyMs = latencyMs;
        route.decision.usage = usage;
        void recordAIUsageEvent({
          user_id: request.userId ?? null,
          project_id: request.projectId ?? null,
          chat_id: request.chatId ?? null,
          task: route.decision.task,
          provider_id: route.provider!.id,
          provider_model: route.providerModel,
          cost_tier: route.provider!.costTier,
          latency_ms: latencyMs,
          usage,
          route: route.decision,
        });
        await request.onFinish?.(event);
      },
      onError: async (event) => {
        const error =
          event && typeof event === "object" && "error" in event
            ? (event as { error?: unknown }).error
            : event;
        const failure = createFailureRecord(
          route.provider!,
          route.providerModel,
          error
        );
        route.decision.fallbackFailures = [failure];
        this.healthManager.markFailure(route.provider!.id, failure.reason, {
          rateLimited: failure.statusCode === 429,
          timeout: failure.reason.toLowerCase().includes("timeout"),
        });
        void recordAIProviderEvent({
          user_id: request.userId ?? null,
          project_id: request.projectId ?? null,
          chat_id: request.chatId ?? null,
          task: route.decision.task,
          type: "stream_failure",
          provider_id: route.provider!.id,
          provider_model: route.providerModel,
          retryable: failure.retryable,
          status_code: failure.statusCode ?? null,
          reason: failure.reason,
          route: route.decision,
        });
        await request.onError?.(event);
      },
    });

    return {
      result: ensureAIStreamTextResult(result),
      modelRoute: route.decision,
      provider: route.provider,
    };
  }
}

export const aiCompletionService = new AICompletionService();

export async function checkLocalOllamaHealth(
  baseUrl = resolveOllamaBaseUrl(),
  timeoutMs = 450
): Promise<ModelProviderHealth> {
  const checkedAt = new Date().toISOString();
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const rootUrl = baseUrl.replace(/\/v1\/?$/, "");
    const response = await fetch(`${rootUrl}/api/tags`, {
      cache: "no-store",
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    const availableModels = extractOllamaModelNames(payload);

    return {
      status: response.ok ? "available" : "unreachable",
      checkedAt,
      latencyMs: Date.now() - startedAt,
      availableModels,
      reason: response.ok
        ? availableModels.length > 0
          ? `Ollama responded locally with ${availableModels.length} installed model(s).`
          : "Ollama responded locally, but no models are installed."
        : `Ollama health check returned ${response.status}.`,
    };
  } catch (error) {
    return {
      status: "unreachable",
      checkedAt,
      latencyMs: Date.now() - startedAt,
      reason:
        error instanceof Error
          ? error.message
          : "Ollama health check failed.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function getModelRouterHealth(options: {
  isDesktopApp?: boolean;
  checkLocal?: boolean;
} = {}) {
  const localBaseUrl = resolveOllamaBaseUrl();
  const localEnabled = isLocalProviderEnabled(options.isDesktopApp);
  const [localHealth, settings] = await Promise.all([
    options.checkLocal && localEnabled
      ? checkLocalOllamaHealth(localBaseUrl)
      : undefined,
    loadAIProviderSettings(),
  ]);

  return buildModelProviderConfigs({
    isDesktopApp: options.isDesktopApp,
    localHealth,
    providerHealth: providerHealthManager.getAll(),
    settings,
  }).map((provider) => {
    const health: ModelProviderHealth =
      provider.health ??
      (provider.configured
        ? {
            status: "configured",
            checkedAt: new Date().toISOString(),
            reason: provider.keyEnvVar
              ? "Provider credentials are configured."
              : "Local provider is enabled.",
          }
        : {
            status: "unconfigured",
            checkedAt: new Date().toISOString(),
            reason: provider.keyEnvVar
              ? "Provider credentials are not configured."
              : "Local provider is not enabled.",
          });

    return {
      ...provider,
      health,
    };
  });
}

function normalizeRoutingText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 6000) : "";
}

function getQualityFallbackTask(task: AIProviderTask): AIProviderTask {
  return task === "chat_assistant" ? "deep_business_reasoning" : task;
}

function buildAutoRoutePrompt(params: {
  text: string;
  fallbackTask: AIProviderTask;
  routingMode: ModelRoutingMode;
}) {
  const modeGuidance =
    params.routingMode === "quality"
      ? "Thinking mode is on. Prioritize answer quality and deep reasoning over latency."
      : "Thinking mode is off. Prefer speed for simple requests, but choose quality for requests that need deep analysis, planning, coding, or high-stakes business judgment.";

  return [
    "You are Rearvy's fast model router. Do not answer the user.",
    "Classify the latest user request so Rearvy can send it to the best final model.",
    modeGuidance,
    "Choose one task: chat_assistant, summary, email_draft, analytics_explanation, deep_business_reasoning, workflow_reasoning, or screen_analysis.",
    "Use deep_business_reasoning for strategy, complex coding, architecture, forecasting, audits, tradeoffs, or requests where a shallow answer would be weak.",
    "Use workflow_reasoning for multi-step agent, browser, desktop, or automation planning.",
    "Use analytics_explanation for metrics, cohorts, revenue, conversion, or insight interpretation.",
    "Use email_draft for Gmail, replies, follow-ups, compose, or message-writing requests.",
    "Set answerPriority to speed, balanced, or quality. Pick quality when the final answer should be better even if slower.",
    `Fallback task from local heuristics: ${params.fallbackTask}.`,
    `User request:\n${params.text}`,
  ].join("\n\n");
}

function applyAutoRouteDecision(params: {
  decision: AutoRouteDecision | null;
  fallbackTask: AIProviderTask;
  routingMode: ModelRoutingMode;
  hasImageInput?: boolean;
}): {
  task: AIProviderTask;
  routingMode: ModelRoutingMode;
  answerPriority: AutoRouteAnswerPriority;
} {
  if (params.hasImageInput) {
    return {
      task: "screen_analysis" as AIProviderTask,
      routingMode: params.routingMode,
      answerPriority:
        params.routingMode === "quality" ? "quality" : "balanced",
    };
  }

  const task = params.decision?.task ?? params.fallbackTask;
  const answerPriority: AutoRouteAnswerPriority =
    params.routingMode === "quality"
      ? "quality"
      : params.decision?.answerPriority ?? "balanced";
  const finalRoutingMode: ModelRoutingMode =
    params.routingMode === "quality" ||
    answerPriority === "quality" ||
    task === "deep_business_reasoning"
      ? "quality"
      : "fast";

  return {
    task:
      finalRoutingMode === "quality"
        ? getQualityFallbackTask(task)
        : task,
    routingMode: finalRoutingMode,
    answerPriority,
  };
}

async function resolveAutoRouteOptions(
  options: ResolveModelForChatOptions
): Promise<ResolveModelForChatOptions> {
  const routingText = normalizeRoutingText(options.routingText);
  const requestedProviderModel = normalizeProviderModel(
    options.requestedProviderModel
  );
  const initialRoutingMode = options.routingMode ?? "fast";
  const fallbackTask =
    options.task ??
    inferAIProviderTask({
      text: routingText,
      hasImageInput: options.hasImageInput,
    });
  const fallback = applyAutoRouteDecision({
    decision: null,
    fallbackTask,
    routingMode: initialRoutingMode,
    hasImageInput: options.hasImageInput,
  });
  const baseOptions: ResolveModelForChatOptions = {
    ...options,
    task: fallback.task,
    routingMode: fallback.routingMode,
    maxCostTier:
      options.maxCostTier ??
      (fallback.routingMode === "quality" ? "premium" : undefined),
  };

  if (
    !options.autoRoute ||
    options.providerId ||
    requestedProviderModel ||
    !routingText ||
    options.hasImageInput
  ) {
    return baseOptions;
  }

  try {
    const routeSelection = await aiCompletionService.generateObject({
      task: "route_selection",
      schema: AutoRouteDecisionSchema,
      prompt: buildAutoRoutePrompt({
        text: routingText,
        fallbackTask,
        routingMode: initialRoutingMode,
      }),
      maxOutputTokens: 180,
      temperature: 0,
      timeoutMs: readPositiveIntegerEnv(
        "AI_ROUTER_TIMEOUT_MS",
        initialRoutingMode === "quality" ? 4500 : 2500
      ),
      isDesktopApp: options.isDesktopApp,
      allowLocal: false,
      allowPremium: false,
      maxCostTier: "free",
      routingMode: "fast",
    });
    const applied = applyAutoRouteDecision({
      decision: routeSelection.object,
      fallbackTask,
      routingMode: initialRoutingMode,
      hasImageInput: options.hasImageInput,
    });

    return {
      ...options,
      task: applied.task,
      routingMode: applied.routingMode,
      maxCostTier:
        options.maxCostTier ??
        (applied.routingMode === "quality" ? "premium" : undefined),
      routing: {
        providerId: routeSelection.modelRoute.providerId,
        providerModel: routeSelection.modelRoute.providerModel,
        selectedTask: applied.task,
        answerPriority: applied.answerPriority,
        reason: routeSelection.object.reason?.trim() || null,
      },
    };
  } catch (error) {
    log.warn("Fast AI model routing unavailable; using fallback task.", error);
    return baseOptions;
  }
}

export async function resolveModelForChat(
  options: ResolveModelForChatOptions = {}
): Promise<RoutedChatModel> {
  const routeOptions = await resolveAutoRouteOptions(options);
  const route = await aiProviderRouter.selectRoute(routeOptions);

  if (!route.provider || !route.providerModel) {
    return {
      model: null,
      decision: route.decision,
      provider: null,
    };
  }

  return {
    model: createProviderLanguageModel(route.provider, route.providerModel),
    decision: route.decision,
    provider: route.provider,
  };
}

export function buildNoModelConfiguredMessage() {
  return [
    "No AI model provider is available right now.",
    "Rearvy can still use synced business data, cached insights, and approved desktop workflows.",
    "Enable local Ollama, add OpenRouter free models, add NVIDIA free inference, or configure an optional provider to generate a live AI response.",
  ].join(" ");
}

export function getOpenRouterFreeModels() {
  return [...OPENROUTER_FREE_MODELS];
}

export function sanitizeModelRouteForClient(decision: ModelRouteDecision) {
  return {
    ...decision,
    baseUrl: null,
  };
}

export function inferAIProviderTask(params: {
  text?: string | null;
  hasImageInput?: boolean;
  needsJson?: boolean;
}): AIProviderTask {
  if (params.hasImageInput) {
    return "screen_analysis";
  }

  if (params.needsJson) {
    return "json_classification";
  }

  const text = params.text?.toLowerCase() ?? "";
  if (/\b(summarize|summary|recap|dashboard summary|tl;dr)\b/.test(text)) {
    return "summary";
  }

  if (/\b(email|gmail|reply|draft|compose|follow[-\s]?up)\b/.test(text)) {
    return "email_draft";
  }

  if (/\b(analytics|explain|insight|metric|conversion|revenue|cohort|trend)\b/.test(text)) {
    return "analytics_explanation";
  }

  if (/\b(strategy|reason deeply|deep reasoning|business plan|forecast|scenario|what if|optimi[sz]e)\b/.test(text)) {
    return "deep_business_reasoning";
  }

  if (detectContentCreationIntent(params.text)) {
    return "deep_business_reasoning";
  }

  if (/\b(workflow|automation|automate|agent|plan steps)\b/.test(text)) {
    return "workflow_reasoning";
  }

  return "chat_assistant";
}
