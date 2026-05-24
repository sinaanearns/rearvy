import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

export type ModelProviderId =
  | "local_ollama"
  | "nvidia"
  | "groq"
  | "together"
  | "openai";

export type ModelCostTier = "local" | "free" | "low" | "premium";

export type ModelProviderCapability =
  | "chat"
  | "vision"
  | "tools"
  | "embeddings"
  | "json";

export type ProviderHealthStatus =
  | "available"
  | "configured"
  | "unconfigured"
  | "unreachable";

export type ModelProviderHealth = {
  status: ProviderHealthStatus;
  checkedAt: string;
  latencyMs?: number;
  reason?: string;
};

export type ModelProviderConfig = {
  id: ModelProviderId;
  name: string;
  baseUrl: string;
  keyEnvVar: string | null;
  defaultModel: string;
  visionModel?: string;
  capabilities: ModelProviderCapability[];
  costTier: ModelCostTier;
  configured: boolean;
  enabled: boolean;
  priority: number;
  health?: ModelProviderHealth;
};

export type ModelRouteDecision = {
  providerId: ModelProviderId | null;
  providerName: string | null;
  providerModel: string | null;
  costTier: ModelCostTier | null;
  baseUrl: string | null;
  reason: string;
  requestedModel: string | null;
  localPreferred: boolean;
  fallbacksTried: string[];
  unavailableReason: string | null;
  capabilities: ModelProviderCapability[];
  selectedAt: string;
};

export type ModelRouteOptions = {
  requestedProviderModel?: string | null;
  hasImageInput?: boolean;
  allowLocal?: boolean;
  now?: Date;
};

export type ResolveModelForChatOptions = {
  requestedProviderModel?: string | null;
  hasImageInput?: boolean;
  isDesktopApp?: boolean;
};

export type RoutedChatModel = {
  model: LanguageModel | null;
  decision: ModelRouteDecision;
  provider: ModelProviderConfig | null;
};

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const TOGETHER_BASE_URL = "https://api.together.xyz/v1";
const OPENAI_BASE_URL = "https://api.openai.com/v1";

function readEnv(name: string) {
  return process.env[name]?.trim() || "";
}

function hasEnv(name: string) {
  return Boolean(readEnv(name));
}

function normalizeBaseUrl(value: string, fallback: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  return trimmed.replace(/\/+$/, "");
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

export function buildModelProviderConfigs(options: {
  isDesktopApp?: boolean;
  localHealth?: ModelProviderHealth;
} = {}): ModelProviderConfig[] {
  const localEnabled = isLocalProviderEnabled(options.isDesktopApp);
  const localVisionModel = readEnv("OLLAMA_VISION_MODEL") || undefined;

  return [
    {
      id: "local_ollama",
      name: "Ollama local",
      baseUrl: resolveOllamaBaseUrl(),
      keyEnvVar: null,
      defaultModel:
        readEnv("OLLAMA_CHAT_MODEL") ||
        readEnv("LOCAL_AI_CHAT_MODEL") ||
        "llama3.1:8b",
      visionModel: localVisionModel,
      capabilities: localVisionModel
        ? ["chat", "vision", "json"]
        : ["chat", "json"],
      costTier: "local",
      configured: localEnabled,
      enabled: localEnabled,
      priority: 10,
      health: options.localHealth,
    },
    {
      id: "nvidia",
      name: "NVIDIA free inference",
      baseUrl: NVIDIA_BASE_URL,
      keyEnvVar: "NVIDIA_API_KEY",
      defaultModel:
        readEnv("NVIDIA_CHAT_MODEL") || "mistralai/ministral-14b-instruct-2512",
      visionModel:
        readEnv("NVIDIA_VISION_MODEL") || "meta/llama-3.2-11b-vision-instruct",
      capabilities: ["chat", "vision", "json"],
      costTier: "free",
      configured: hasEnv("NVIDIA_API_KEY"),
      enabled: hasEnv("NVIDIA_API_KEY"),
      priority: 20,
    },
    {
      id: "groq",
      name: "Groq open-source cloud",
      baseUrl: normalizeBaseUrl(readEnv("GROQ_BASE_URL"), GROQ_BASE_URL),
      keyEnvVar: "GROQ_API_KEY",
      defaultModel: readEnv("GROQ_CHAT_MODEL") || "llama-3.1-8b-instant",
      capabilities: ["chat", "json"],
      costTier: "low",
      configured: hasEnv("GROQ_API_KEY"),
      enabled: hasEnv("GROQ_API_KEY"),
      priority: 30,
    },
    {
      id: "together",
      name: "Together open-source cloud",
      baseUrl: normalizeBaseUrl(readEnv("TOGETHER_BASE_URL"), TOGETHER_BASE_URL),
      keyEnvVar: "TOGETHER_API_KEY",
      defaultModel:
        readEnv("TOGETHER_CHAT_MODEL") ||
        "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
      capabilities: ["chat", "json"],
      costTier: "low",
      configured: hasEnv("TOGETHER_API_KEY"),
      enabled: hasEnv("TOGETHER_API_KEY"),
      priority: 40,
    },
    {
      id: "openai",
      name: "Premium API",
      baseUrl: normalizeBaseUrl(readEnv("OPENAI_BASE_URL"), OPENAI_BASE_URL),
      keyEnvVar: "OPENAI_API_KEY",
      defaultModel: readEnv("OPENAI_CHAT_MODEL") || "gpt-4o-mini",
      visionModel: readEnv("OPENAI_VISION_MODEL") || readEnv("OPENAI_CHAT_MODEL"),
      capabilities: ["chat", "vision", "tools", "json"],
      costTier: "premium",
      configured: hasEnv("OPENAI_API_KEY"),
      enabled: hasEnv("OPENAI_API_KEY"),
      priority: 50,
    },
  ];
}

function providerSupportsRequest(
  provider: ModelProviderConfig,
  options: ModelRouteOptions
) {
  if (!provider.enabled || !provider.configured) {
    return false;
  }

  if (provider.health?.status === "unreachable") {
    return false;
  }

  if (provider.id === "local_ollama" && options.allowLocal === false) {
    return false;
  }

  if (options.hasImageInput && !provider.capabilities.includes("vision")) {
    return false;
  }

  return provider.capabilities.includes("chat");
}

function selectProviderModel(
  provider: ModelProviderConfig,
  options: ModelRouteOptions
) {
  if (options.hasImageInput && provider.visionModel) {
    return provider.visionModel;
  }

  if (provider.id === "nvidia" && options.requestedProviderModel) {
    return options.requestedProviderModel;
  }

  return provider.defaultModel;
}

export function selectModelRouteCandidate(
  providers: ModelProviderConfig[],
  options: ModelRouteOptions = {}
): {
  provider: ModelProviderConfig | null;
  providerModel: string | null;
  decision: ModelRouteDecision;
} {
  const now = options.now ?? new Date();
  const orderedProviders = [...providers].sort(
    (left, right) => left.priority - right.priority
  );
  const fallbacksTried: string[] = [];
  const localPreferred = options.allowLocal !== false;

  for (const provider of orderedProviders) {
    if (!providerSupportsRequest(provider, options)) {
      fallbacksTried.push(provider.id);
      continue;
    }

    const providerModel = selectProviderModel(provider, options);
    return {
      provider,
      providerModel,
      decision: {
        providerId: provider.id,
        providerName: provider.name,
        providerModel,
        costTier: provider.costTier,
        baseUrl: provider.baseUrl,
        reason:
          provider.id === "local_ollama"
            ? "Selected local inference to keep free-tier cost near zero."
            : `Selected ${provider.name} as the lowest-cost configured provider for this request.`,
        requestedModel: options.requestedProviderModel ?? null,
        localPreferred,
        fallbacksTried,
        unavailableReason: null,
        capabilities: provider.capabilities,
        selectedAt: now.toISOString(),
      },
    };
  }

  return {
    provider: null,
    providerModel: null,
    decision: {
      providerId: null,
      providerName: null,
      providerModel: null,
      costTier: null,
      baseUrl: null,
      reason: "No configured model provider is currently available.",
      requestedModel: options.requestedProviderModel ?? null,
      localPreferred,
      fallbacksTried,
      unavailableReason:
        "Enable Ollama/local AI, configure NVIDIA_API_KEY, or add an optional cloud provider key.",
      capabilities: [],
      selectedAt: now.toISOString(),
    },
  };
}

function getProviderApiKey(provider: ModelProviderConfig) {
  if (!provider.keyEnvVar) {
    return "ollama";
  }

  return readEnv(provider.keyEnvVar);
}

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

    return {
      status: response.ok ? "available" : "unreachable",
      checkedAt,
      latencyMs: Date.now() - startedAt,
      reason: response.ok
        ? "Ollama responded locally."
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
  const localHealth =
    options.checkLocal && localEnabled
      ? await checkLocalOllamaHealth(localBaseUrl)
      : undefined;

  return buildModelProviderConfigs({
    isDesktopApp: options.isDesktopApp,
    localHealth,
  }).map((provider) => {
    const health: ModelProviderHealth =
      provider.health ??
      (provider.configured
        ? {
            status: "configured",
            checkedAt: new Date().toISOString(),
            reason: provider.keyEnvVar
              ? `${provider.keyEnvVar} is present.`
              : "Local provider is enabled.",
          }
        : {
            status: "unconfigured",
            checkedAt: new Date().toISOString(),
            reason: provider.keyEnvVar
              ? `${provider.keyEnvVar} is not configured.`
              : "Local provider is not enabled.",
          });

    return {
      ...provider,
      health,
    };
  });
}

export async function resolveModelForChat(
  options: ResolveModelForChatOptions = {}
): Promise<RoutedChatModel> {
  const localEnabled = isLocalProviderEnabled(options.isDesktopApp);
  const localHealth = localEnabled
    ? await checkLocalOllamaHealth(resolveOllamaBaseUrl())
    : undefined;
  const providers = buildModelProviderConfigs({
    isDesktopApp: options.isDesktopApp,
    localHealth,
  });
  const route = selectModelRouteCandidate(providers, {
    requestedProviderModel: options.requestedProviderModel,
    hasImageInput: options.hasImageInput,
    allowLocal: true,
  });

  if (!route.provider || !route.providerModel) {
    return {
      model: null,
      decision: route.decision,
      provider: null,
    };
  }

  const provider = createOpenAICompatible({
    name: route.provider.id,
    baseURL: route.provider.baseUrl,
    apiKey: getProviderApiKey(route.provider),
  });

  return {
    model: provider.chatModel(route.providerModel),
    decision: route.decision,
    provider: route.provider,
  };
}

export function buildNoModelConfiguredMessage() {
  return [
    "No AI model provider is available right now.",
    "Rearvy can still use synced business data, cached insights, and approved desktop workflows.",
    "Enable local Ollama, add NVIDIA free inference, or configure an optional cloud provider to generate a live AI response.",
  ].join(" ");
}
