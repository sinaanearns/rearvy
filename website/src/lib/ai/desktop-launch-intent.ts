export type DesktopLaunchAction =
  | {
      type: "launchApp";
      appPath: string;
      args?: string[];
      wait?: boolean;
    }
  | {
      type: "openPath";
      target: string;
      wait?: boolean;
    };

export type DesktopLaunchIntent = {
  kind: "app" | "browser";
  label: string;
  target: string;
  action: DesktopLaunchAction;
};

export type DesktopLaunchWorkflowInput = {
  description: string;
  name: string;
  steps: Array<{
    id: string;
    name: string;
    action: DesktopLaunchAction;
    timeout: number;
  }>;
};

const DEFAULT_BROWSER_URL = "https://www.google.com";

const DIRECT_LAUNCH_PATTERN =
  /^(?:please\s+)?(?:(?:can|could|would)\s+you\s+|i\s+want\s+you\s+to\s+)?(open|launch|start|run)\s+(.+?)\s*$/i;
const BARE_APP_REPLY_PATTERN =
  /^(?:the\s+|a\s+|an\s+|my\s+|our\s+)?(.+?)\s+(?:desktop\s+)?(?:app|application|program)$/i;
const REPEAT_LAUNCH_PATTERN =
  /^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:open|launch|start|run)\s+(?:(?:it|that|this|the\s+same|same\s+app|same\s+one)\s+)?again$/i;

const URL_LIKE_PATTERN = /^(?:https?:\/\/|www\.)/i;
const DOMAIN_PATTERN =
  /^(?:www\.)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?$/i;
const FILE_PATH_PATTERN = /^(?:[a-z]:[\\/]|~?[\\/]|\.{1,2}[\\/])/i;

const BROWSER_ALIASES: Record<string, DesktopLaunchIntent> = {
  browser: {
    kind: "browser",
    label: "default browser",
    target: "browser",
    action: { type: "openPath", target: DEFAULT_BROWSER_URL, wait: true },
  },
  "web browser": {
    kind: "browser",
    label: "default browser",
    target: "web browser",
    action: { type: "openPath", target: DEFAULT_BROWSER_URL, wait: true },
  },
  "default browser": {
    kind: "browser",
    label: "default browser",
    target: "default browser",
    action: { type: "openPath", target: DEFAULT_BROWSER_URL, wait: true },
  },
  chrome: {
    kind: "browser",
    label: "Chrome",
    target: "chrome",
    action: { type: "launchApp", appPath: "chrome.exe", wait: true },
  },
  "chrome browser": {
    kind: "browser",
    label: "Chrome",
    target: "chrome browser",
    action: { type: "launchApp", appPath: "chrome.exe", wait: true },
  },
  "google chrome": {
    kind: "browser",
    label: "Chrome",
    target: "google chrome",
    action: { type: "launchApp", appPath: "chrome.exe", wait: true },
  },
  edge: {
    kind: "browser",
    label: "Microsoft Edge",
    target: "edge",
    action: { type: "launchApp", appPath: "msedge.exe", wait: true },
  },
  "edge browser": {
    kind: "browser",
    label: "Microsoft Edge",
    target: "edge browser",
    action: { type: "launchApp", appPath: "msedge.exe", wait: true },
  },
  "microsoft edge": {
    kind: "browser",
    label: "Microsoft Edge",
    target: "microsoft edge",
    action: { type: "launchApp", appPath: "msedge.exe", wait: true },
  },
  firefox: {
    kind: "browser",
    label: "Firefox",
    target: "firefox",
    action: { type: "launchApp", appPath: "firefox.exe", wait: true },
  },
  "firefox browser": {
    kind: "browser",
    label: "Firefox",
    target: "firefox browser",
    action: { type: "launchApp", appPath: "firefox.exe", wait: true },
  },
  "mozilla firefox": {
    kind: "browser",
    label: "Firefox",
    target: "mozilla firefox",
    action: { type: "launchApp", appPath: "firefox.exe", wait: true },
  },
  brave: {
    kind: "browser",
    label: "Brave",
    target: "brave",
    action: { type: "launchApp", appPath: "brave.exe", wait: true },
  },
  "brave browser": {
    kind: "browser",
    label: "Brave",
    target: "brave browser",
    action: { type: "launchApp", appPath: "brave.exe", wait: true },
  },
  opera: {
    kind: "browser",
    label: "Opera",
    target: "opera",
    action: { type: "launchApp", appPath: "opera.exe", wait: true },
  },
};

const APP_ALIASES: Record<string, { label: string; appPath: string; args?: string[] }> = {
  calculator: { label: "Calculator", appPath: "calc.exe" },
  calc: { label: "Calculator", appPath: "calc.exe" },
  notepad: { label: "Notepad", appPath: "notepad.exe" },
  paint: { label: "Paint", appPath: "mspaint.exe" },
  explorer: { label: "File Explorer", appPath: "explorer.exe" },
  "file explorer": { label: "File Explorer", appPath: "explorer.exe" },
  terminal: { label: "Terminal", appPath: "wt.exe" },
  powershell: { label: "PowerShell", appPath: "powershell.exe" },
  "command prompt": { label: "Command Prompt", appPath: "cmd.exe" },
  cmd: { label: "Command Prompt", appPath: "cmd.exe" },
  settings: { label: "Windows Settings", appPath: "explorer.exe", args: ["ms-settings:"] },
  outlook: { label: "Outlook", appPath: "outlook.exe" },
  word: { label: "Word", appPath: "winword.exe" },
  "microsoft word": { label: "Word", appPath: "winword.exe" },
  excel: { label: "Excel", appPath: "excel.exe" },
  "microsoft excel": { label: "Excel", appPath: "excel.exe" },
  powerpoint: { label: "PowerPoint", appPath: "powerpnt.exe" },
  "microsoft powerpoint": { label: "PowerPoint", appPath: "powerpnt.exe" },
  onenote: { label: "OneNote", appPath: "onenote.exe" },
  teams: { label: "Microsoft Teams", appPath: "Teams" },
  "microsoft teams": { label: "Microsoft Teams", appPath: "Teams" },
  slack: { label: "Slack", appPath: "Slack" },
  discord: { label: "Discord", appPath: "Discord" },
  spotify: { label: "Spotify", appPath: "Spotify" },
  zoom: { label: "Zoom", appPath: "Zoom" },
  figma: { label: "Figma", appPath: "Figma" },
  notion: { label: "Notion", appPath: "Notion" },
  blender: { label: "Blender", appPath: "Blender" },
  antigravity: { label: "Antigravity", appPath: "Antigravity" },
  atigravity: { label: "Antigravity", appPath: "Antigravity" },
  antigavity: { label: "Antigravity", appPath: "Antigravity" },
  antigravty: { label: "Antigravity", appPath: "Antigravity" },
  "anti gravity": { label: "Antigravity", appPath: "Antigravity" },
  "antigravity desktop": { label: "Antigravity", appPath: "Antigravity" },
  "atigravity desktop": { label: "Antigravity", appPath: "Antigravity" },
  "anti gravity desktop": { label: "Antigravity", appPath: "Antigravity" },
  "antigravity ide": { label: "Antigravity IDE", appPath: "Antigravity IDE" },
  "vs code": { label: "Visual Studio Code", appPath: "Code.exe" },
  vscode: { label: "Visual Studio Code", appPath: "Code.exe" },
  "visual studio code": { label: "Visual Studio Code", appPath: "Code.exe" },
  "visual studio": { label: "Visual Studio", appPath: "Visual Studio" },
};

function normalizeText(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTargetKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\w.+:/\\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanupTarget(value: string) {
  return normalizeText(value)
    .replace(/[.?!]+$/g, "")
    .replace(/^(?:the|a|an|my|our)\s+/i, "")
    .replace(/\s+(?:from|on|in)\s+(?:the\s+|my\s+)?(?:desktop|computer|pc|windows)$/i, "")
    .replace(/\s+(?:app|application|program|window)$/i, "")
    .trim();
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function shouldTreatUnknownAsApp(verb: string, rawTarget: string, targetKey: string) {
  if (
    FILE_PATH_PATTERN.test(rawTarget) ||
    URL_LIKE_PATTERN.test(rawTarget) ||
    DOMAIN_PATTERN.test(rawTarget)
  ) {
    return false;
  }

  if (/^command\s*:/i.test(rawTarget) || /^terminal\s+command\b/i.test(rawTarget)) {
    return false;
  }

  const explicitAppTarget = /\b(app|application|program)\b/i.test(rawTarget);
  if (explicitAppTarget) {
    return true;
  }

  const explicitDesktopTarget =
    /\b(?:from|on|in)\s+(?:the\s+|my\s+)?(?:desktop|computer|pc|windows)\b/i.test(
      rawTarget
    );
  if (verb === "open" && explicitDesktopTarget) {
    return targetKey.split(/\s+/).filter(Boolean).length <= 4;
  }

  if (verb === "launch" || verb === "start") {
    return targetKey.split(/\s+/).filter(Boolean).length <= 4;
  }

  return false;
}

function buildKnownLaunchIntent(rawTarget: string): DesktopLaunchIntent | null {
  const targetKey = normalizeTargetKey(rawTarget);
  if (!targetKey) {
    return null;
  }

  const browserAlias = BROWSER_ALIASES[targetKey];
  if (browserAlias) {
    return browserAlias;
  }

  const appAlias = APP_ALIASES[targetKey];
  if (appAlias) {
    return {
      kind: "app",
      label: appAlias.label,
      target: rawTarget,
      action: {
        type: "launchApp",
        appPath: appAlias.appPath,
        ...(appAlias.args ? { args: appAlias.args } : {}),
        wait: true,
      },
    };
  }

  return null;
}

function buildUnknownAppLaunchIntent(rawTarget: string): DesktopLaunchIntent | null {
  const targetKey = normalizeTargetKey(rawTarget);
  if (!targetKey) {
    return null;
  }

  if (
    FILE_PATH_PATTERN.test(rawTarget) ||
    URL_LIKE_PATTERN.test(rawTarget) ||
    DOMAIN_PATTERN.test(rawTarget)
  ) {
    return null;
  }

  return {
    kind: "app",
    label: titleCase(rawTarget),
    target: rawTarget,
    action: { type: "launchApp", appPath: rawTarget, wait: true },
  };
}

export function buildDesktopLaunchIntentFromTarget(
  rawTarget: string | null | undefined
): DesktopLaunchIntent | null {
  const target = cleanupTarget(rawTarget ?? "");
  return buildKnownLaunchIntent(target) ?? buildUnknownAppLaunchIntent(target);
}

function hasPriorLaunchRequestContext(value: string | null | undefined) {
  const text = normalizeText(value);
  const match = text.match(DIRECT_LAUNCH_PATTERN);
  if (!match?.[1] || !match[2]) {
    return false;
  }

  if (/^command\s*:/i.test(match[2]) || /^terminal\s+command\b/i.test(match[2])) {
    return false;
  }

  return true;
}

export function detectDesktopLaunchIntent(
  userText: string | null | undefined
): DesktopLaunchIntent | null {
  const text = normalizeText(userText);
  const match = text.match(DIRECT_LAUNCH_PATTERN);
  if (!match?.[1] || !match[2]) {
    return null;
  }

  const verb = match[1].toLowerCase();
  const rawTarget = cleanupTarget(match[2]);
  const targetKey = normalizeTargetKey(rawTarget);
  if (!targetKey) {
    return null;
  }

  const knownIntent = buildKnownLaunchIntent(rawTarget);
  if (knownIntent) {
    return knownIntent;
  }

  if (shouldTreatUnknownAsApp(verb, match[2], targetKey)) {
    return buildUnknownAppLaunchIntent(rawTarget);
  }

  return null;
}

export function detectDesktopLaunchFollowUpIntent(
  previousUserText: string | null | undefined,
  userText: string | null | undefined
): DesktopLaunchIntent | null {
  if (!hasPriorLaunchRequestContext(previousUserText)) {
    return null;
  }

  const text = normalizeText(userText);
  const match = text.match(BARE_APP_REPLY_PATTERN);
  if (!match?.[1]) {
    return null;
  }

  const rawTarget = cleanupTarget(match[1]);
  return buildDesktopLaunchIntentFromTarget(rawTarget);
}

export function isDesktopLaunchRepeatRequest(
  userText: string | null | undefined
) {
  return REPEAT_LAUNCH_PATTERN.test(normalizeText(userText));
}

export function buildDesktopLaunchWorkflow(
  intent: DesktopLaunchIntent
): DesktopLaunchWorkflowInput {
  return {
    name: `Open ${intent.label}`,
    description: `Open ${intent.label} through the desktop OS.`,
    steps: [
      {
        id: "step_open_target",
        name: `Open ${intent.label}`,
        action: intent.action,
        timeout: 20000,
      },
    ],
  };
}
