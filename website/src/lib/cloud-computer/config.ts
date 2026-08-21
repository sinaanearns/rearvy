export type CloudComputerConfig = {
  enabled: boolean;
  provider: "browserbase";
  apiKey: string;
  projectId: string;
  region: "us-west-2" | "us-east-1" | "eu-central-1" | "ap-southeast-1";
  maxActiveSessions: number;
  timeoutSeconds: number;
  apiBaseUrl?: string;
  stagehandModel: string;
  modelApiKey?: string;
};

export type CloudComputerAvailability = {
  available: boolean;
  reason?: string;
  config?: CloudComputerConfig;
};

const DEFAULT_REGION = "us-west-2";
const DEFAULT_MAX_ACTIVE_SESSIONS = 1;
const DEFAULT_TIMEOUT_SECONDS = 900;
const DEFAULT_STAGEHAND_MODEL = "gpt-4.1-mini";

function envFlagEnabled(value: string | undefined, fallback = false) {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeRegion(value: string | undefined): CloudComputerConfig["region"] {
  switch (value) {
    case "us-east-1":
    case "eu-central-1":
    case "ap-southeast-1":
    case "us-west-2":
      return value;
    default:
      return DEFAULT_REGION;
  }
}

export function isVercelRuntime() {
  return Boolean(process.env.VERCEL);
}

export function isCloudComputerFeatureEnabled() {
  return envFlagEnabled(process.env.CLOUD_COMPUTER_ENABLED, false);
}

export function getCloudComputerConfig(): CloudComputerAvailability {
  if (!isCloudComputerFeatureEnabled()) {
    return {
      available: false,
      reason: "Cloud computer is disabled. Set CLOUD_COMPUTER_ENABLED=true.",
    };
  }

  const apiKey = process.env.BROWSERBASE_API_KEY?.trim() || "";
  const projectId = process.env.BROWSERBASE_PROJECT_ID?.trim() || "";

  if (!apiKey || !projectId) {
    return {
      available: false,
      reason: "Missing Browserbase configuration. Set BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID.",
    };
  }

  return {
    available: true,
    config: {
      enabled: true,
      provider: "browserbase",
      apiKey,
      projectId,
      region: normalizeRegion(process.env.BROWSERBASE_REGION),
      maxActiveSessions: parsePositiveInt(
        process.env.CLOUD_COMPUTER_MAX_ACTIVE_SESSIONS,
        DEFAULT_MAX_ACTIVE_SESSIONS
      ),
      timeoutSeconds: parsePositiveInt(
        process.env.CLOUD_COMPUTER_TIMEOUT_SECONDS,
        DEFAULT_TIMEOUT_SECONDS
      ),
      apiBaseUrl: process.env.BROWSERBASE_BASE_URL?.trim() || undefined,
      stagehandModel:
        process.env.CLOUD_COMPUTER_STAGEHAND_MODEL?.trim() || DEFAULT_STAGEHAND_MODEL,
      modelApiKey:
        process.env.CLOUD_COMPUTER_STAGEHAND_MODEL_API_KEY?.trim() ||
        process.env.NVIDIA_API_KEY?.trim() ||
        undefined,
    },
  };
}

export function shouldPreferCloudComputer(params: {
  requestedMethod?: string | null;
  localAvailable?: boolean;
}) {
  if (params.requestedMethod === "cloud-browser") {
    return true;
  }

  if (params.requestedMethod && params.requestedMethod !== "auto") {
    return false;
  }

  return isVercelRuntime() || params.localAvailable === false;
}
