import { Memori } from "@memorilabs/memori";
import {
  OpenClawIntegration,
  type IntegrationRequest,
} from "@memorilabs/memori/integrations";

type MemoriScope = {
  userId: string;
  chatId: string;
  projectId?: string | null;
  agentId?: string | null;
};

type MemoriRecallInput = MemoriScope & {
  userText: string;
};

type MemoriCaptureInput = MemoriScope & {
  userMessage: string;
  assistantMessage: string;
  model: string;
  provider: string;
  trace?: IntegrationRequest["trace"];
};

const MEMORI_PLATFORM = "rearvy";
const MEMORI_INTEGRATION_VERSION = "rearvy-memori-v1";

function isMemoriEnabled() {
  return Boolean(process.env.MEMORI_API_KEY?.trim());
}

function parseEnvNumber(
  value: string | undefined,
  predicate: (num: number) => boolean
) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && predicate(parsed) ? parsed : null;
}

function buildProcessId({
  projectId,
  agentId,
}: Pick<MemoriScope, "projectId" | "agentId">) {
  if (projectId && agentId) {
    return `rearvy:project:${projectId}:agent:${agentId}`;
  }

  if (projectId) {
    return `rearvy:project:${projectId}:chat`;
  }

  if (agentId) {
    return `rearvy:agent:${agentId}`;
  }

  return "rearvy:chat";
}

function createMemoriIntegration(scope: MemoriScope) {
  if (!isMemoriEnabled()) {
    return null;
  }

  const memori = new Memori();
  const timeoutMs = parseEnvNumber(
    process.env.MEMORI_TIMEOUT_MS,
    (num) => num > 0
  );
  const recallThreshold = parseEnvNumber(
    process.env.MEMORI_RECALL_THRESHOLD,
    (num) => num >= 0 && num <= 1
  );

  if (timeoutMs !== null) {
    memori.config.timeout = timeoutMs;
  }

  if (recallThreshold !== null) {
    memori.config.recallRelevanceThreshold = recallThreshold;
  }

  const integration = memori.integrate(OpenClawIntegration);
  integration.setAttribution(
    scope.userId,
    buildProcessId({
      projectId: scope.projectId,
      agentId: scope.agentId,
    })
  );
  integration.setSession(scope.chatId);

  return integration;
}

export async function buildMemoriRecallContext({
  userText,
  ...scope
}: MemoriRecallInput) {
  const trimmedUserText = userText.trim();
  if (!trimmedUserText) {
    return null;
  }

  const integration = createMemoriIntegration(scope);
  if (!integration) {
    return null;
  }

  try {
    return (await integration.recall(trimmedUserText)) ?? null;
  } catch (error) {
    console.warn("Memori recall skipped:", error);
    return null;
  }
}

export async function captureMemoriConversation({
  userMessage,
  assistantMessage,
  model,
  provider,
  trace,
  ...scope
}: MemoriCaptureInput) {
  const trimmedUserMessage = userMessage.trim();
  const trimmedAssistantMessage = assistantMessage.trim();

  if (!trimmedUserMessage || !trimmedAssistantMessage) {
    return;
  }

  const integration = createMemoriIntegration(scope);
  if (!integration) {
    return;
  }

  try {
    await integration.augmentation({
      userMessage: trimmedUserMessage,
      agentResponse: trimmedAssistantMessage,
      trace,
      metadata: {
        provider,
        model,
        sdkVersion: null,
        integrationSdkVersion: MEMORI_INTEGRATION_VERSION,
        platform: MEMORI_PLATFORM,
      },
    });
  } catch (error) {
    console.warn("Memori capture skipped:", error);
  }
}
