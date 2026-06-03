export type DesktopPermissionIntent = {
  kind: "microphone";
};

export type DesktopPermissionWorkflowInput = {
  description: string;
  name: string;
  steps: Array<{
    id: string;
    name: string;
    action: { type: string; [key: string]: unknown };
    timeout: number;
  }>;
};

const MICROPHONE_TERMS =
  /\b(?:microphone|mic|audio|voice|speech|recording|recorder)\b/i;
const CURLY_APOSTROPHES_PATTERN = /[\u2018\u2019\u201A\u201B]/g;
const CURLY_QUOTES_PATTERN = /[\u201C\u201D\u201E\u201F]/g;
const PERMISSION_TERMS =
  /\b(?:access|permission|allow|enable|grant|fix|issue|problem|unavailable|capture|record|listen|blocked|denied|not\s+working)\b/i;
const AUDIO_CAPTURE_ERROR =
  /\b(?:could\s+not\s+capture\s+audio|audio\s+capture|microphone\s+permission|microphone\s+unavailable|mic\s+permission)\b/i;
const GENERIC_ACCESS_REQUEST =
  /\b(?:(?:give|grant|allow|enable|provide)\s+(?:me\s+|you\s+|it\s+|the\s+)?(?:access|permission)|(?:give|grant)\s+(?:the\s+)?access)\b/i;
const BUSINESS_DATA_ACCESS_TERMS =
  /\b(?:shopify|gmail|youtube|instagram|analytics|revenue|orders|customers|data|database|firestore|integration|integrations|api|oauth|account|platform|store)\b/i;
const DEVICE_CONTROL_ACCESS_TERMS =
  /\b(?:100%|full|device|computer|desktop|screen|screenshot|screen\s+shot|mouse|cursor|keyboard|key\s*press|click|type|write|clipboard|window|app|application|control|everything)\b/i;

export function normalizeDesktopPermissionIntentText(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(CURLY_APOSTROPHES_PATTERN, "'")
    .replace(CURLY_QUOTES_PATTERN, '"')
    .replace(/\bacsses\b/g, "access")
    .replace(/\bacces\b/g, "access")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectDesktopPermissionIntent(
  value: string | null | undefined
): DesktopPermissionIntent | null {
  const text = normalizeDesktopPermissionIntentText(value);
  if (!text) {
    return null;
  }

  if (AUDIO_CAPTURE_ERROR.test(text)) {
    return { kind: "microphone" };
  }

  if (MICROPHONE_TERMS.test(text) && PERMISSION_TERMS.test(text)) {
    return { kind: "microphone" };
  }

  if (
    GENERIC_ACCESS_REQUEST.test(text) &&
    !BUSINESS_DATA_ACCESS_TERMS.test(text) &&
    !DEVICE_CONTROL_ACCESS_TERMS.test(text)
  ) {
    return { kind: "microphone" };
  }

  return null;
}

export function normalizeDesktopPlatform(value: unknown): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim().toLowerCase()
    : null;
}

export function canUseWindowsMicrophonePermissionWorkflow(
  desktopPlatform: string | null
) {
  return desktopPlatform === null || desktopPlatform === "win32";
}

export function buildWindowsMicrophonePermissionWorkflow(): DesktopPermissionWorkflowInput {
  return {
    name: "Open microphone privacy settings",
    description:
      "Open Windows microphone privacy settings so the user can enable microphone access for Rearvy.",
    steps: [
      {
        id: "step_open_microphone_privacy",
        name: "Open microphone privacy settings",
        action: {
          type: "launchApp",
          appPath: "explorer.exe",
          args: ["ms-settings:privacy-microphone"],
          wait: true,
        },
        timeout: 10000,
      },
      {
        id: "step_wait_for_settings",
        name: "Wait for settings",
        action: { type: "wait", ms: 1500 },
        timeout: 3000,
      },
      {
        id: "step_capture_settings",
        name: "Capture settings screen",
        action: { type: "screenshot", analyze: false },
        timeout: 5000,
      },
    ],
  };
}
