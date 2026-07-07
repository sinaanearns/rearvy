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

export type DesktopWorkflowAction =
  | DesktopLaunchAction
  | {
      type: "screenshot";
      analyze?: boolean;
    }
  | {
      type: "wait";
      ms: number;
    }
  | {
      type: "revealPath";
      target: string;
    }
  | {
      type: "readFile";
      path: string;
    }
  | {
      type: "readVisibleText";
      maxTextItems?: number;
    }
  | {
      type: "getElementState";
      text: string;
      controlType?: string;
      timeoutMs?: number;
    }
  | {
      type: "getElementValue";
      text: string;
      controlType?: string;
      timeoutMs?: number;
    }
  | {
      type: "invokeElement";
      text: string;
      controlType?: string;
      timeoutMs?: number;
    }
  | {
      type: "listDirectory";
      path: string;
    }
  | {
      type: "createDirectory";
      path: string;
      revealAfterCreate?: boolean;
      openAfterCreate?: boolean;
    }
  | {
      type: "copyPath";
      sourcePath: string;
      destinationPath: string;
      overwrite?: boolean;
      revealAfterCopy?: boolean;
      openAfterCopy?: boolean;
    }
  | {
      type: "movePath";
      sourcePath: string;
      destinationPath: string;
      revealAfterMove?: boolean;
      openAfterMove?: boolean;
    }
  | {
      type: "trashPath";
      path: string;
    }
  | {
      type: "writeFile";
      path: string;
      content: string;
      revealAfterWrite?: boolean;
      openAfterWrite?: boolean;
    }
  | {
      type: "appendToFile";
      path: string;
      content: string;
      appendNewline?: boolean;
      backup?: boolean;
      revealAfterAppend?: boolean;
      openAfterAppend?: boolean;
    }
  | {
      type: "replaceInFile";
      path: string;
      search: string;
      replacement: string;
      replaceAll?: boolean;
      backup?: boolean;
      revealAfterReplace?: boolean;
      openAfterReplace?: boolean;
    }
  | {
      type: "shellCommand";
      command: string;
    }
  | {
      type: "listWindows";
    }
  | {
      type: "listUiElements";
      controlType?: string;
      maxElements?: number;
    }
  | {
      type: "focusWindow";
      windowTitle: string;
    }
  | {
      type: "setWindowState";
      state: "minimize" | "maximize" | "restore";
      windowTitle?: string;
    }
  | {
      type: "type";
      text: string;
      delay?: number;
    }
  | {
      type: "keyPress";
      key: string;
      modifiers?: string[];
    }
  | {
      type: "click";
      x: number;
      y: number;
      button?: "left" | "right" | "middle";
      double?: boolean;
    }
  | {
      type: "clickElement";
      text: string;
      controlType?: string;
      button?: "left" | "right" | "middle";
      double?: boolean;
    }
  | {
      type: "typeIntoElement";
      text: string;
      value: string;
      controlType?: string;
      clear?: boolean;
    }
  | {
      type: "setElementValue";
      text: string;
      value: string;
      controlType?: string;
      timeoutMs?: number;
    }
  | {
      type: "selectOption";
      option: string;
      text?: string;
      controlType?: string;
    }
  | {
      type: "setToggleState";
      text: string;
      state: "checked" | "unchecked" | "toggle";
      controlType?: string;
    }
  | {
      type: "waitForElement";
      text: string;
      controlType?: string;
      timeoutMs?: number;
    }
  | {
      type: "moveMouse";
      x: number;
      y: number;
    }
  | {
      type: "dragMouse";
      fromX?: number;
      fromY?: number;
      toX: number;
      toY: number;
      button?: "left" | "right" | "middle";
      durationMs?: number;
      steps?: number;
    }
  | {
      type: "mouseDown";
      button?: "left" | "right" | "middle";
    }
  | {
      type: "mouseUp";
      button?: "left" | "right" | "middle";
    }
  | {
      type: "scroll";
      direction: "up" | "down" | "left" | "right";
      amount: number;
    }
  | {
      type: "setClipboard";
      text: string;
    }
  | {
      type: "getClipboard";
    }
  | {
      type: "closeWindow";
      force?: boolean;
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
    action: DesktopWorkflowAction;
    timeout: number;
  }>;
};

type WriteFileRequest = {
  path: string;
  content: string;
};

type AppendToFileRequest = {
  path: string;
  content: string;
  openAfterAppend: boolean;
};

type ReplaceInFileRequest = {
  path: string;
  search: string;
  replacement: string;
  replaceAll: boolean;
  openAfterReplace: boolean;
};

type CreateDirectoryRequest = {
  path: string;
  openAfterCreate: boolean;
};

type CopyPathRequest = {
  sourcePath: string;
  destinationPath: string;
  overwrite: boolean;
  openAfterCopy: boolean;
};

type MovePathRequest = {
  sourcePath: string;
  destinationPath: string;
  openAfterMove: boolean;
};

type TrashPathRequest = {
  path: string;
};

type DesktopClickButton = "left" | "right" | "middle";

type DesktopClickRequest = {
  x: number;
  y: number;
  button: DesktopClickButton;
  double: boolean;
};

type DesktopClickElementRequest = {
  text: string;
  controlType?: string;
  button: DesktopClickButton;
  double: boolean;
};

type DesktopKeyPressRequest = {
  key: string;
  modifiers?: string[];
};

type DesktopWindowState = "minimize" | "maximize" | "restore";

type DesktopPoint = {
  x: number;
  y: number;
};

type DesktopDragRequest = {
  from?: DesktopPoint;
  to: DesktopPoint;
  button?: DesktopClickButton;
};

const DEFAULT_BROWSER_URL = "https://www.google.com";
const CLICKY_RESEARCH_SEARCH_PATTERN =
  /\b(?:competitors?|research|screenshots?|product\s+like|similar\s+to|inspired\s+by|pricing|onboarding|dashboard|ui\s+patterns?)\b/i;
const CURLY_APOSTROPHES_PATTERN = /[\u2018\u2019\u201A\u201B]/g;
const CURLY_QUOTES_PATTERN = /[\u201C\u201D\u201E\u201F]/g;

const DIRECT_LAUNCH_PATTERN =
  /^(?:please\s+)?(?:(?:can|could|would)\s+you\s+|i\s+want\s+you\s+to\s+)?(open|launch|start|run)\s+(.+?)\s*$/i;
const BARE_APP_REPLY_PATTERN =
  /^(?:the\s+|a\s+|an\s+|my\s+|our\s+)?(.+?)\s+(?:desktop\s+)?(?:app|application|program)$/i;
const REPEAT_LAUNCH_PATTERN =
  /^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:open|launch|start|run)\s+(?:(?:it|that|this|the\s+same|same\s+app|same\s+one)\s+)?again$/i;
const CLICKY_DESKTOP_OPERATOR_PATTERN =
  /\b(?:clicky|work\s+on\s+(?:that\s+|the\s+|my\s+)?app|open\s+(?:an?\s+)?app|use\s+(?:that\s+|the\s+|my\s+)?app|control\s+(?:that\s+|the\s+|my\s+)?app|desktop\s+operator|operate\s+(?:my\s+)?desktop|take\s+(?:a\s+)?screenshot|capture\s+(?:a\s+)?screenshot|show\s+(?:it|this|that)\s+to\s+(?:the\s+)?user|do\s+anything\s+on\s+(?:my\s+)?(?:desktop|computer|pc))\b/i;
const BROWSER_OR_WEBSITE_ONLY_PATTERN =
  /\b(?:website|web\s*site|browser|competitor|competitors?|page|url|https?:\/\/|www\.)\b/i;

const URL_LIKE_PATTERN = /^(?:https?:\/\/|www\.)/i;
const DOMAIN_PATTERN =
  /^(?:www\.)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?$/i;
const FILE_PATH_PATTERN = /^(?:[a-z]:[\\/]|~?[\\/]|\.{1,2}[\\/])/i;
const COMMAND_PREFIX_PATTERN =
  /^(?:npm(?:\.cmd)?|npx(?:\.cmd)?|pnpm|yarn|bun|node|tsx|ts-node|python|py|uv|pip|git|gh|vercel|next|tsc|eslint|prettier|vitest|jest|pytest|cargo|go|rustc|deno|docker|docker-compose|powershell|pwsh|cmd|bash|sh|dir|ls|echo|type|cat|where|which|cd|\.\\|\.\/)\b/i;

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
    .replace(CURLY_APOSTROPHES_PATTERN, "'")
    .replace(CURLY_QUOTES_PATTERN, '"')
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

function extractAppTargetFromOperatorText(userText: string) {
  const text = normalizeText(userText);
  if (parseShellCommand(text)) {
    return null;
  }

  const patterns = [
    /\b(?:open|launch|start|run)\s+(?:an?\s+)?(.+?)\s*(?:and|then|to|so|,|$)/i,
    /\b(?:work\s+on|use|control)\s+(?:that\s+|the\s+|my\s+)?(.+?)\s+(?:app|application|program)\b/i,
    /\b(?:in|inside)\s+(?:the\s+|my\s+)?(.+?)\s+(?:app|application|program)\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) {
      continue;
    }

    const target = cleanupTarget(match[1]);
    if (
      target &&
      !/^(?:app|application|program|website|browser|site|page|it|that|this)$/i.test(target)
    ) {
      return target;
    }
  }

  return null;
}

function extractWebTargetFromOperatorText(userText: string) {
  const text = normalizeText(userText);
  if (FILE_PATH_PATTERN.test(text)) {
    return null;
  }

  const urlMatch = text.match(
    /\b(https?:\/\/[^\s)]+|www\.[^\s)]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s)]*)?)\b/i
  );
  if (urlMatch?.[1]) {
    const matchIndex = typeof urlMatch.index === "number" ? urlMatch.index : -1;
    if (matchIndex > 0 && text[matchIndex - 1] === "@") {
      return null;
    }
    const rawUrl = urlMatch[1].replace(/[.,;]+$/g, "");
    if (/\.(?:txt|md|json|log|csv|docx?|xlsx?|png|jpe?g|gif|webp|pdf)$/i.test(rawUrl)) {
      return null;
    }
    return /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  }

  if (/\b(?:open|use|inspect|visit|go\s+to)\s+(?:a\s+|the\s+)?(?:website|web\s*site|browser|competitor\s+page|competitors?\s+page)\b/i.test(text)) {
    return CLICKY_RESEARCH_SEARCH_PATTERN.test(text)
      ? buildDesktopResearchSearchUrl(text)
      : DEFAULT_BROWSER_URL;
  }

  return null;
}

function buildDesktopResearchSearchUrl(text: string) {
  const query = text
    .replace(/\bclicky\b/gi, "")
    .replace(/\b(?:open|launch|start|run)\s+(?:an?\s+)?[^,]+?\s*(?:and|then|to|so|,|$)/i, "")
    .replace(/\b(?:open|use|inspect|visit|go\s+to)\s+(?:a\s+|the\s+)?(?:website|web\s*site|browser|page)\b/gi, "")
    .replace(/\b(?:finds?|take|capture)\s+screenshots?\b/gi, "screenshots")
    .replace(/\blog(?:s)?\s*in\b/gi, "login flow")
    .replace(/\s+/g, " ")
    .trim();
  const normalizedQuery = query || "competitor product screenshots pricing onboarding dashboard";
  const enrichedQuery = [
    normalizedQuery,
    /\bcompetitors?\b/i.test(text) ? "competitors" : "",
    /\bscreenshots?\b/i.test(text) ? "screenshots" : "",
    /\b(?:product\s+like|similar\s+to|inspired\s+by|dashboard|onboarding|pricing)\b/i.test(text)
      ? "product UI pricing onboarding dashboard"
      : "",
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return `${DEFAULT_BROWSER_URL}/search?q=${encodeURIComponent(enrichedQuery)}`;
}

function firstQuotedValue(value: string) {
  const match = value.match(/["'`]([^"'`]+)["'`]/);
  return match?.[1]?.trim() || null;
}

function quotedValues(value: string) {
  return Array.from(value.matchAll(/["'`]([^"'`]+)["'`]/g))
    .map((match) => match[1]?.trim())
    .filter((item): item is string => Boolean(item));
}

function firstPathLikeValue(value: string) {
  const quoted = firstQuotedValue(value);
  if (quoted) {
    return quoted;
  }

  const match = value.match(
    /\b(?:[a-z]:[\\/][^\r\n"'`]+|\.{1,2}[\\/][^\r\n"'`]+|~?[\\/][^\r\n"'`]+)\b/i
  );
  return match?.[0]?.trim().replace(/[.,;]+$/g, "") || null;
}

function parseShellCommand(value: string) {
  const explicitMatch = value.match(
    /\b(?:run|execute)\s+(?:the\s+)?(?:terminal\s+|shell\s+|powershell\s+|cmd\s+)?command\s*:?\s+(.+)$/i
  );
  if (explicitMatch?.[1]) {
    return explicitMatch[1].trim().replace(/^["'`]+|["'`]+$/g, "") || null;
  }

  const quotedMatch = value.match(/\b(?:run|execute)\s+["'`]([^"'`]+)["'`]$/i);
  if (quotedMatch?.[1] && COMMAND_PREFIX_PATTERN.test(quotedMatch[1].trim())) {
    return quotedMatch[1].trim();
  }

  const terminalMatch = value.match(
    /\b(?:terminal|shell|powershell|cmd)\b[\s\S]*?\b(?:run|execute)\s+(.+)$/i
  );
  if (terminalMatch?.[1] && COMMAND_PREFIX_PATTERN.test(terminalMatch[1].trim())) {
    return terminalMatch[1].trim().replace(/^["'`]+|["'`]+$/g, "") || null;
  }

  const naturalMatch = value.match(
    /^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:run|execute)\s+(.+)$/i
  );
  if (naturalMatch?.[1] && COMMAND_PREFIX_PATTERN.test(naturalMatch[1].trim())) {
    return naturalMatch[1].trim().replace(/^["'`]+|["'`]+$/g, "") || null;
  }

  return null;
}

function parseTypeTextRequest(value: string) {
  const text = normalizeText(value);
  if (parseWriteFileRequest(text) || parseSetClipboardRequest(text)) {
    return null;
  }
  if (/\b(?:type|enter|input|fill|write)\s+.+?\s+(?:into|in|inside|on)\s+(?:the\s+)?\S+/i.test(text)) {
    return null;
  }

  const quotedMatch = text.match(
    /\b(?:type|write|enter|input)\s+["'`]([^"'`]+)["'`]/i
  );
  if (quotedMatch?.[1]) {
    return quotedMatch[1].trim();
  }

  const plainMatch = text.match(
    /\b(?:type|enter|input)\s+(.+?)(?:\s+(?:into|in|on|using)\s+(?:the\s+|my\s+)?(?:app|application|program|window|notepad|editor)|\s+and\s+(?:screenshot|show|capture|press)|$)/i
  );
  if (plainMatch?.[1]) {
    const typed = plainMatch[1]
      .replace(/^text\s+/i, "")
      .replace(/[.,;]+$/g, "")
      .trim();
    if (typed && !/^(?:it|that|this|the\s+app|the\s+window)$/i.test(typed)) {
      return typed;
    }
  }

  return null;
}

function parseKeyPressRequest(value: string): DesktopKeyPressRequest | null {
  const text = normalizeText(value);
  const clipboardShortcut = parseClipboardShortcutRequest(text);
  if (clipboardShortcut) {
    return clipboardShortcut;
  }

  const shortcutMatch = text.match(
    /\b(?:press|hit|use)\s+(ctrl|control|shift|alt|cmd|command)\s*\+?\s*([a-z0-9]+)\b/i
  );
  if (shortcutMatch?.[1] && shortcutMatch[2]) {
    const modifier = shortcutMatch[1].toLowerCase();
    const normalizedModifier =
      modifier === "ctrl" || modifier === "control"
        ? "Control"
        : modifier === "cmd" || modifier === "command"
          ? "Meta"
          : `${modifier.charAt(0).toUpperCase()}${modifier.slice(1)}`;
    return {
      key: `${normalizedModifier}+${shortcutMatch[2]}`,
      modifiers: [normalizedModifier],
    };
  }

  const keyMatch = text.match(
    /\b(?:press|hit)\s+(enter|tab|escape|esc|space|backspace|delete|up|down|left|right)\b/i
  );
  if (keyMatch?.[1]) {
    const key = keyMatch[1].toLowerCase();
    const normalizedKey =
      key === "esc"
        ? "Escape"
        : key === "space"
          ? "Space"
          : `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
    return { key: normalizedKey };
  }

  return null;
}

function parseSetClipboardRequest(value: string) {
  const text = normalizeText(value);
  const quotedMatch = text.match(
    /\b(?:copy|set|put|save)\s+["'`]([^"'`]+)["'`]\s+(?:to|into|in|on)\s+(?:the\s+)?clipboard\b/i
  );
  if (quotedMatch?.[1]) {
    return quotedMatch[1].trim();
  }

  const clipboardFirstMatch = text.match(
    /\b(?:set|put|save)\s+(?:the\s+)?clipboard\s+(?:to|as)\s+["'`]([^"'`]+)["'`]/i
  );
  if (clipboardFirstMatch?.[1]) {
    return clipboardFirstMatch[1].trim();
  }

  const clipboardPlainMatch = text.match(
    /\b(?:set|put|save)\s+(?:the\s+)?clipboard\s+(?:to|as)\s+(.+?)(?:\s+(?:and|then|,)\s+(?:paste|type|show|screenshot|capture)\b|$)/i
  );
  if (clipboardPlainMatch?.[1]) {
    return clipboardPlainMatch[1].replace(/[.,;]+$/g, "").trim();
  }

  return null;
}

function parseGetClipboardRequest(value: string) {
  return /\b(?:read|get|show|inspect|check)\s+(?:the\s+)?clipboard\b|\bwhat(?:'s| is)\s+on\s+(?:the\s+)?clipboard\b/i.test(
    normalizeText(value)
  );
}

function parseClipboardShortcutRequest(value: string): DesktopKeyPressRequest | null {
  const text = normalizeText(value);
  if (/\b(?:paste|paste\s+clipboard|insert\s+clipboard)\b/i.test(text)) {
    return { key: "Control+v", modifiers: ["Control"] };
  }

  if (/\b(?:copy\s+(?:selection|selected\s+text|current\s+selection)|copy\s+it\s+to\s+(?:the\s+)?clipboard)\b/i.test(text)) {
    return { key: "Control+c", modifiers: ["Control"] };
  }

  return null;
}

function parseCoordinatePair(value: string) {
  const match = value.match(/(?:^|\b(?:at|to|on|position|coordinates?)\s+|\s)(?:x\s*)?(\d{1,4})\s*[,x]\s*(?:y\s*)?(\d{1,4})\b/i);
  if (!match?.[1] || !match[2]) {
    return null;
  }

  const x = Number(match[1]);
  const y = Number(match[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return {
    x: Math.max(0, Math.round(x)),
    y: Math.max(0, Math.round(y)),
  };
}

function parseClickRequest(value: string): DesktopClickRequest | null {
  const text = normalizeText(value);
  if (!/\b(?:click|double\s+click|right\s+click|middle\s+click)\b/i.test(text)) {
    return null;
  }

  const actionText = text.slice(Math.max(0, text.search(/\b(?:click|double\s+click|right\s+click|middle\s+click)\b/i)));
  const point = parseCoordinatePair(actionText);
  if (!point) {
    return null;
  }

  const button: DesktopClickButton = /\bright\s+click\b/i.test(text)
    ? "right"
    : /\bmiddle\s+click\b/i.test(text)
      ? "middle"
      : "left";

  return {
    ...point,
    button,
    double: /\bdouble\s+click\b/i.test(text),
  };
}

function parseClickElementRequest(value: string): DesktopClickElementRequest | null {
  const text = normalizeText(value);
  if (!/\b(?:click|double\s+click|right\s+click|middle\s+click|press|select)\b/i.test(text)) {
    return null;
  }

  const quoted = firstQuotedValue(text);
  const clauses = text.split(/\s*(?:,|\band\b|\bthen\b)\s*/i).filter(Boolean);
  const clauseMatch = clauses
    .map((clause) =>
      clause.match(
        /^(?:click|double\s+click|right\s+click|middle\s+click|press|select)\s+(?:the\s+)?(.+?)\s+(button|field|input|textbox|text\s+box|link|tab|menu|item|checkbox|option|icon)$/i
      )
    )
    .find((match) => {
      const candidate = match?.[1] || "";
      return Boolean(match) && !/^(?:at|to|on|position|coordinates?)\b/i.test(candidate) && !parseCoordinatePair(candidate);
    });
  const explicitControlLabelPattern =
    /\b(?:click|double\s+click|right\s+click|middle\s+click|press|select)\s+(?:the\s+)?(.+?)\s+(button|field|input|textbox|text\s+box|link|tab|menu|item|checkbox|option|icon)(?:\s+(?:in|on|inside|using)\s+(?:the\s+)?(?:app|application|window|screen|page|browser))?(?=\s+(?:and|then)\b|,\s*|$)/gi;
  const fallbackLabelPattern =
    /\b(?:click|double\s+click|right\s+click|middle\s+click|press|select)\s+(?:the\s+)?(.+?)(?:\s+(?:in|on|inside|using)\s+(?:the\s+)?(?:app|application|window|screen|page|browser))?(?=\s+(?:and|then)\b|,\s*|$)/gi;
  const labelMatch = clauseMatch ?? [...text.matchAll(explicitControlLabelPattern)].find((match) => {
    const candidate = match[1] || "";
    return !candidate.includes("click ") && !/^(?:at|to|on|position|coordinates?)\b/i.test(candidate) && !parseCoordinatePair(candidate);
  }) ?? [...text.matchAll(fallbackLabelPattern)].find((match) => {
    const candidate = match[1] || "";
    return !candidate.includes("click ") && !/^(?:at|to|on|position|coordinates?)\b/i.test(candidate) && !parseCoordinatePair(candidate);
  });
  const rawLabel = quoted || labelMatch?.[1] || "";
  const trailingControlType = rawLabel.match(
    /\s+(button|field|input|textbox|text\s+box|link|tab|menu|item|checkbox|option|icon)$/i
  )?.[1];
  const label = rawLabel
    .replace(/^(?:the|a|an)\s+/i, "")
    .replace(/\s+(?:button|field|input|textbox|text\s+box|link|tab|menu|item|checkbox|option|icon)$/i, "")
    .replace(/[.,;]+$/g, "")
    .trim();

  if (!label || /^(?:it|that|this|there|here|screen|window|app|application)$/i.test(label)) {
    return null;
  }

  const controlTypeRaw = (labelMatch?.[2] || trailingControlType)?.toLowerCase().replace(/\s+/g, "");
  const controlType =
    controlTypeRaw === "field" || controlTypeRaw === "input" || controlTypeRaw === "textbox"
      ? "edit"
      : controlTypeRaw === "item"
        ? undefined
        : controlTypeRaw;
  const button: DesktopClickButton = /\bright\s+click\b/i.test(text)
    ? "right"
    : /\bmiddle\s+click\b/i.test(text)
      ? "middle"
      : "left";

  return {
    text: label,
    ...(controlType ? { controlType } : {}),
    button,
    double: /\bdouble\s+click\b/i.test(text),
  };
}

function parseTypeIntoElementRequest(value: string) {
  const text = normalizeText(value);
  const match = text.match(
    /\b(?:type|enter|input|fill|write)\s+(.+?)\s+(?:into|in|inside|on)\s+(?:the\s+)?(.+?)(?:\s+(field|input|textbox|text\s+box|box|area))?(?=\s+(?:and|then)\b|,\s*|$)/i
  );
  if (!match?.[1] || !match?.[2]) {
    return null;
  }

  const valueToType = stripWrappingQuotes(match[1])
    .replace(/^(?:text|value)\s+/i, "")
    .replace(/[.,;]+$/g, "")
    .trim();
  const label = stripWrappingQuotes(match[2])
    .replace(/^(?:the|a|an)\s+/i, "")
    .replace(/\s+(?:field|input|textbox|text\s+box|box|area)$/i, "")
    .replace(/[.,;]+$/g, "")
    .trim();
  if (
    !valueToType ||
    !label ||
    /^(?:it|that|this|there|here|screen|window|app|application)$/i.test(label)
  ) {
    return null;
  }

  return {
    text: label,
    value: valueToType,
    controlType: "edit",
    clear: !/\b(?:without\s+clearing|append|add\s+to)\b/i.test(text),
  };
}

function parseSetElementValueRequest(value: string) {
  const text = normalizeText(value);
  const match = text.match(
    /\b(?:set|fill|change|update)\s+(?:the\s+)?(.+?)(?:\s+(field|input|textbox|text\s+box|box|area))?\s+(?:to|as|with)\s+(.+?)(?=\s+(?:and|then)\b|,\s*|$)/i
  );
  if (!match?.[1] || !match?.[3]) {
    return null;
  }

  const label = stripWrappingQuotes(match[1])
    .replace(/^(?:the|a|an)\s+/i, "")
    .replace(/\s+(?:field|input|textbox|text\s+box|box|area)$/i, "")
    .replace(/[.,;]+$/g, "")
    .trim();
  const valueToSet = stripWrappingQuotes(match[3])
    .replace(/^(?:text|value)\s+/i, "")
    .replace(/[.,;]+$/g, "")
    .trim();
  if (
    !label ||
    !valueToSet ||
    /^(?:it|that|this|there|here|screen|window|app|application)$/i.test(label)
  ) {
    return null;
  }

  return {
    text: label,
    value: valueToSet,
    controlType: "edit",
    timeoutMs: 8000,
  };
}

function parseSelectOptionRequest(value: string) {
  const text = normalizeText(value);
  const match = text.match(
    /\b(?:select|choose|pick)\s+(.+?)\s+(?:from|in|inside|on)\s+(?:the\s+)?(.+?)(?:\s+(dropdown|select|combobox|combo\s+box|menu|list|field))?(?=\s+(?:and|then)\b|,\s*|$)/i
  );
  if (!match?.[1] || !match?.[2]) {
    return null;
  }

  const option = stripWrappingQuotes(match[1])
    .replace(/^(?:the\s+)?option\s+/i, "")
    .replace(/[.,;]+$/g, "")
    .trim();
  const label = stripWrappingQuotes(match[2])
    .replace(/^(?:the|a|an)\s+/i, "")
    .replace(/\s+(?:dropdown|select|combobox|combo\s+box|menu|list|field)$/i, "")
    .replace(/[.,;]+$/g, "")
    .trim();
  if (!option || !label || /^(?:it|that|this|there|here|screen|window|app|application)$/i.test(label)) {
    return null;
  }

  const controlType = /\b(?:menu)\b/i.test(match[3] || "") ? "menu" : "combobox";
  return { option, text: label, controlType };
}

type DesktopToggleState = "checked" | "unchecked" | "toggle";

function parseSetToggleStateRequest(
  value: string
): { text: string; state: DesktopToggleState; controlType: string } | null {
  const text = normalizeText(value);
  const match = text.match(
    /\b(?:(check|uncheck|toggle)|turn\s+(on|off)|set\s+(.+?)\s+(?:to\s+)?(on|off|checked|unchecked))\s+(?:the\s+)?(.+?)(?:\s+(checkbox|check\s+box|switch|toggle))?(?=\s+(?:and|then)\b|,\s*|$)/i
  );
  if (!match) {
    return null;
  }

  const stateToken = (match[1] || match[2] || match[4] || "toggle").toLowerCase();
  const state: DesktopToggleState = stateToken === "check" || stateToken === "on" || stateToken === "checked"
    ? "checked"
    : stateToken === "uncheck" || stateToken === "off" || stateToken === "unchecked"
      ? "unchecked"
      : "toggle";
  const rawLabel = match[3] || match[5] || "";
  const label = stripWrappingQuotes(rawLabel)
    .replace(/^(?:the|a|an)\s+/i, "")
    .replace(/\s+(?:checkbox|check\s+box|switch|toggle)$/i, "")
    .replace(/[.,;]+$/g, "")
    .trim();
  if (!label || /^(?:it|that|this|there|here|screen|window|app|application)$/i.test(label)) {
    return null;
  }

  return {
    text: label,
    state,
    controlType: "checkbox",
  };
}

function parseWaitForElementRequest(value: string) {
  const text = normalizeText(value);
  const match = text.match(
    /\b(?:wait\s+(?:for|until)|wait\s+until\s+(?:the\s+)?)\s+(?:the\s+)?(.+?)(?:\s+(button|field|input|textbox|text\s+box|link|tab|menu|item|checkbox|option|icon|dropdown))?(?:\s+(?:appears?|is\s+visible|shows?\s+up|loads?))?(?=\s+(?:and|then)\b|,\s*|$)/i
  );
  if (!match?.[1]) {
    return null;
  }

  const label = stripWrappingQuotes(match[1])
    .replace(/^(?:the|a|an)\s+/i, "")
    .replace(
      /\s+(?:button|field|input|textbox|text\s+box|link|tab|menu|item|checkbox|option|icon|dropdown)$/i,
      ""
    )
    .replace(/[.,;]+$/g, "")
    .trim();
  if (!label || /^(?:it|that|this|there|here|screen|window|app|application)$/i.test(label)) {
    return null;
  }

  const rawControlType = match[2]?.toLowerCase().replace(/\s+/g, "");
  const controlType =
    rawControlType === "field" || rawControlType === "input" || rawControlType === "textbox"
      ? "edit"
      : rawControlType === "dropdown"
        ? "combobox"
        : rawControlType === "item"
          ? undefined
          : rawControlType;

  return {
    text: label,
    ...(controlType ? { controlType } : {}),
    timeoutMs: 15000,
  };
}

function parseMoveMouseRequest(value: string) {
  const text = normalizeText(value);
  if (!/\b(?:move|place|put)\s+(?:the\s+)?(?:mouse|cursor)\b/i.test(text)) {
    return null;
  }

  const actionText = text.slice(Math.max(0, text.search(/\b(?:move|place|put)\s+(?:the\s+)?(?:mouse|cursor)\b/i)));
  return parseCoordinatePair(actionText);
}

function parseDragMouseRequest(value: string): DesktopDragRequest | null {
  const text = normalizeText(value);
  const dragIndex = text.search(/\b(?:drag|drag\s+mouse|drag\s+cursor)\b/i);
  if (dragIndex < 0) {
    return null;
  }

  const actionText = text.slice(dragIndex);
  const fromMatch = actionText.match(
    /\bfrom\s+(.+?)\s+(?:to|towards?)\s+(.+?)(?:\s+(?:and|then|,)\b|$)/i
  );
  if (fromMatch?.[1] && fromMatch[2]) {
    const from = parseCoordinatePair(fromMatch[1]);
    const to = parseCoordinatePair(fromMatch[2]);
    if (to) {
      return {
        ...(from ? { from } : {}),
        to,
        button: /\bright\b/i.test(actionText) ? "right" : "left",
      };
    }
  }

  const toMatch = actionText.match(
    /\b(?:to|towards?)\s+(.+?)(?:\s+(?:and|then|,)\b|$)/i
  );
  const to = toMatch?.[1] ? parseCoordinatePair(toMatch[1]) : parseCoordinatePair(actionText);
  if (!to) {
    return null;
  }

  return {
    to,
    button: /\bright\b/i.test(actionText) ? "right" : "left",
  };
}

function parseMouseButtonRequests(value: string) {
  const text = normalizeText(value);
  const button: DesktopClickButton = /\bright\b/i.test(text)
    ? "right"
    : /\bmiddle\b/i.test(text)
      ? "middle"
      : "left";
  const actions: Array<{ type: "mouseDown" | "mouseUp"; button: DesktopClickButton }> = [];

  if (/\b(?:mouse\s+down|hold\s+(?:the\s+)?mouse|hold\s+(?:left|right|middle)\s+(?:mouse|button|click))\b/i.test(text)) {
    actions.push({ type: "mouseDown", button });
  }

  if (/\b(?:mouse\s+up|release\s+(?:the\s+)?mouse|release\s+(?:left|right|middle)\s+(?:mouse|button|click))\b/i.test(text)) {
    actions.push({ type: "mouseUp", button });
  }

  return actions;
}

function parseScrollRequest(value: string) {
  const text = normalizeText(value);
  const match = text.match(/\bscroll\s+(up|down|left|right)(?:\s+(\d{1,5}))?\b/i);
  if (!match?.[1]) {
    return null;
  }

  const rawAmount = match[2] ? Number(match[2]) : 650;
  return {
    direction: match[1].toLowerCase() as "up" | "down" | "left" | "right",
    amount: Number.isFinite(rawAmount) ? Math.max(1, Math.round(rawAmount)) : 650,
  };
}

function parseReadVisibleTextRequest(value: string) {
  return /\b(?:read|extract|scan|show|capture)\s+(?:the\s+)?(?:visible\s+|screen\s+|current\s+)?text(?:\s+(?:from|on|in)\s+(?:the\s+)?(?:screen|window|app|page|desktop))?\b|\bwhat\s+(?:text|words)\s+(?:is|are)\s+(?:visible|on\s+screen)\b/i.test(
    normalizeText(value)
  );
}

function parseGetElementStateRequest(value: string) {
  const text = normalizeText(value);
  const match = text.match(
    /\b(?:get|read|check|inspect|show|tell\s+me)\s+(?:the\s+)?(?:state|status|properties|enabled|checked|visible)\s+(?:of\s+)?(?:the\s+)?(.+?)(?:\s+(button|field|input|textbox|text\s+box|link|tab|menu|item|checkbox|option|icon|dropdown|switch))?(?=\s+(?:and|then)\b|,\s*|$)|\bis\s+(?:the\s+)?(.+?)(?:\s+(button|field|input|textbox|text\s+box|link|tab|menu|item|checkbox|option|icon|dropdown|switch))?\s+(checked|unchecked|enabled|disabled|visible)\b/i
  );
  const rawLabel = match?.[1] || match?.[3] || "";
  if (!rawLabel) {
    return null;
  }

  const label = stripWrappingQuotes(rawLabel)
    .replace(/^(?:the|a|an)\s+/i, "")
    .replace(
      /\s+(?:button|field|input|textbox|text\s+box|link|tab|menu|item|checkbox|option|icon|dropdown|switch)$/i,
      ""
    )
    .replace(/[.,;]+$/g, "")
    .trim();
  if (!label || /^(?:it|that|this|there|here|screen|window|app|application)$/i.test(label)) {
    return null;
  }

  const rawControlType = (match?.[2] || match?.[4])?.toLowerCase().replace(/\s+/g, "");
  const controlType =
    rawControlType === "field" || rawControlType === "input" || rawControlType === "textbox"
      ? "edit"
      : rawControlType === "dropdown"
        ? "combobox"
        : rawControlType === "switch"
          ? "checkbox"
          : rawControlType === "item"
            ? undefined
            : rawControlType;

  return {
    text: label,
    ...(controlType ? { controlType } : {}),
    timeoutMs: 8000,
  };
}

function parseGetElementValueRequest(value: string) {
  const text = normalizeText(value);
  const match = text.match(
    /\b(?:get|read|check|inspect|show|tell\s+me)\s+(?:the\s+)?(?:value|content|contents|text)\s+(?:of\s+|from\s+)?(?:the\s+)?(.+?)(?:\s+(field|input|textbox|text\s+box|box|area))?(?=\s+(?:and|then)\b|,\s*|$)|\bwhat(?:'s| is)\s+(?:in|inside|on)\s+(?:the\s+)?(.+?)(?:\s+(field|input|textbox|text\s+box|box|area))?\b/i
  );
  const rawLabel = match?.[1] || match?.[3] || "";
  if (!rawLabel) {
    return null;
  }

  const label = stripWrappingQuotes(rawLabel)
    .replace(/^(?:the|a|an)\s+/i, "")
    .replace(/\s+(?:field|input|textbox|text\s+box|box|area)$/i, "")
    .replace(/[.,;]+$/g, "")
    .trim();
  if (!label || /^(?:it|that|this|there|here|screen|window|app|application)$/i.test(label)) {
    return null;
  }

  return {
    text: label,
    controlType: "edit",
    timeoutMs: 8000,
  };
}

function parseInvokeElementRequest(value: string) {
  const text = normalizeText(value);
  const match = text.match(
    /\b(?:invoke|activate|press|trigger)\s+(?:the\s+)?(.+?)(?:\s+(button|link|tab|menu|menu\s+item|item|option|icon))?(?=\s+(?:and|then)\b|,\s*|$)/i
  );
  if (!match?.[1]) {
    return null;
  }

  const label = stripWrappingQuotes(match[1])
    .replace(/^(?:the|a|an)\s+/i, "")
    .replace(/\s+(?:button|link|tab|menu|menu\s+item|item|option|icon)$/i, "")
    .replace(/[.,;]+$/g, "")
    .trim();
  if (!label || /^(?:it|that|this|there|here|screen|window|app|application)$/i.test(label)) {
    return null;
  }

  const rawControlType = match[2]?.toLowerCase().replace(/\s+/g, "");
  const controlType =
    rawControlType === "menu"
      ? "menuitem"
      : rawControlType === "item"
        ? undefined
        : rawControlType;

  return {
    text: label,
    ...(controlType ? { controlType } : {}),
    timeoutMs: 8000,
  };
}

function parseCloseWindowRequest(value: string) {
  return /\b(?:close|dismiss)\s+(?:the\s+)?(?:current\s+|active\s+)?(?:window|app|application)\b|\balt\s*\+?\s*f4\b/i.test(
    normalizeText(value)
  );
}

function parseFocusWindowRequest(value: string) {
  const text = normalizeText(value);
  const match = text.match(
    /\b(?:focus|switch\s+to|bring\s+(?:up|forward|to\s+front)|activate|\bgo\s+to)\s+(?:the\s+)?(.+?)(?:\s+(?:window|app|application|browser))?(?=\s+(?:and|then|before|after)\b|,\s*|$)/i
  );
  if (!match?.[1]) {
    return null;
  }

  const quoted = firstQuotedValue(match[1]);
  const title = stripWrappingQuotes(quoted || match[1])
    .replace(/^(?:the|a|an)\s+/i, "")
    .replace(/\s+(?:window|app|application|browser)\b.*$/i, "")
    .replace(/\s+(?:before|after|and|then|,)\b.*$/i, "")
    .replace(/\s+(?:window|app|application|browser)$/i, "")
    .replace(/[.,;]+$/g, "")
    .trim();

  if (!title || /^(?:current|active|window|app|application|browser|it|that|this)$/i.test(title)) {
    return null;
  }

  return { windowTitle: title };
}

function parseListWindowsRequest(value: string) {
  return /\b(?:list|show|what(?:'s| is)|which)\s+(?:the\s+)?(?:open|visible|active|running)?\s*(?:windows|apps|applications)\b|\b(?:open|visible|active|running)\s+(?:windows|apps|applications)\b/i.test(
    normalizeText(value)
  );
}

function parseListUiElementsRequest(value: string) {
  const text = normalizeText(value);
  if (
    !/\b(?:list|show|scan|inspect|find|what(?:'s| is)|which)\s+(?:the\s+)?(?:visible\s+|available\s+|current\s+)?(?:ui\s+)?(?:elements|controls|buttons|fields|inputs|links|tabs|menus|checkboxes)\b/i.test(
      text
    )
  ) {
    return null;
  }

  const controlType = /\bbuttons?\b/i.test(text)
    ? "button"
    : /\b(?:fields?|inputs?|textboxes?|text\s+boxes?)\b/i.test(text)
      ? "edit"
      : /\blinks?\b/i.test(text)
        ? "link"
        : /\btabs?\b/i.test(text)
          ? "tab"
          : /\bmenus?\b/i.test(text)
            ? "menuitem"
            : /\bcheckbox(?:es)?\b/i.test(text)
              ? "checkbox"
              : undefined;

  return { ...(controlType ? { controlType } : {}), maxElements: 80 };
}

function parseSetWindowStateRequest(
  value: string
): { state: DesktopWindowState; windowTitle?: string } | null {
  const text = normalizeText(value);
  const match = text.match(
    /\b(maximi[sz]e|minimi[sz]e|restore)\s+(?:the\s+)?(?:(current|active|foreground)\s+)?(.+?)?(?:\s+(?:window|app|application|browser))?(?:\s+(?:and|then|,)\b|$)/i
  );
  if (!match?.[1]) {
    return null;
  }

  const rawState = match[1].toLowerCase();
  const state: DesktopWindowState = rawState.startsWith("max")
    ? "maximize"
    : rawState.startsWith("min")
      ? "minimize"
      : "restore";
  const rawTitle = stripWrappingQuotes(match[3] || "")
    .replace(/^(?:the|a|an)\s+/i, "")
    .replace(/\s+(?:window|app|application|browser)\b.*$/i, "")
    .replace(/\s+(?:before|after|and|then|,)\b.*$/i, "")
    .replace(/[.,;]+$/g, "")
    .trim();
  const windowTitle =
    rawTitle && !/^(?:current|active|foreground|window|app|application|browser|it|that|this)$/i.test(rawTitle)
      ? rawTitle
      : undefined;

  return { state, ...(windowTitle ? { windowTitle } : {}) };
}

function stripWrappingQuotes(value: string) {
  return value.trim().replace(/^["'`]+|["'`]+$/g, "");
}

function cleanWriteContent(value: string) {
  return stripWrappingQuotes(
    value.replace(/\s+(?:and|then)\s+(?:open|launch)\s+(?:it|the\s+file|that\s+file)\.?$/i, "")
  );
}

function cleanWritePath(value: string) {
  return stripWrappingQuotes(
    value
      .replace(/\s+(?:and|then)\s+(?:open|launch)\s+(?:it|the\s+file|that\s+file)\.?$/i, "")
      .replace(/[.,;]+$/g, "")
  );
}

function cleanAppendContent(value: string) {
  return stripWrappingQuotes(
    value.replace(/\s+(?:and|then)\s+(?:open|launch)\s+(?:it|the\s+file|that\s+file)\.?$/i, "")
  );
}

function cleanAppendPath(value: string) {
  return stripWrappingQuotes(
    value
      .replace(/^(?:the\s+)?(?:file|path)\s+/i, "")
      .replace(/\s+(?:and|then)\s+(?:show|reveal|open|launch|locate)\s+(?:it|the\s+file|that\s+file)\.?$/i, "")
      .replace(/[.,;]+$/g, "")
  );
}

function cleanReplaceText(value: string) {
  return stripWrappingQuotes(value);
}

function cleanReplacePath(value: string) {
  return stripWrappingQuotes(
    value
      .replace(/^(?:the\s+)?(?:file|path)\s+/i, "")
      .replace(/\s+(?:and|then)\s+(?:show|reveal|open|launch|locate)\s+(?:it|the\s+file|that\s+file)\.?$/i, "")
      .replace(/[.,;]+$/g, "")
  );
}

function cleanDirectoryPath(value: string) {
  return stripWrappingQuotes(
    value
      .replace(/^(?:at|named|called)\s+/i, "")
      .replace(
        /\s+(?:and|then)\s+(?:show|reveal|open|launch|locate)\s+(?:it|the\s+folder|that\s+folder|the\s+directory|that\s+directory)\.?$/i,
        ""
      )
      .replace(/[.,;]+$/g, "")
  );
}

function cleanCopyPath(value: string) {
  return stripWrappingQuotes(
    value
      .replace(/^(?:the\s+)?(?:file|folder|directory|path)\s+/i, "")
      .replace(
        /\s+(?:and|then)\s+(?:show|reveal|open|launch|locate)\s+(?:it|the\s+copy|the\s+copied\s+(?:file|folder|directory)|that\s+copy)\.?$/i,
        ""
      )
      .replace(/[.,;]+$/g, "")
  );
}

function cleanMovePath(value: string) {
  return stripWrappingQuotes(
    value
      .replace(/^(?:the\s+)?(?:file|folder|directory|path)\s+/i, "")
      .replace(
        /\s+(?:and|then)\s+(?:show|reveal|open|launch|locate)\s+(?:it|the\s+moved\s+(?:file|folder|directory)|the\s+renamed\s+(?:file|folder|directory)|the\s+new\s+path)\.?$/i,
        ""
      )
      .replace(/[.,;]+$/g, "")
  );
}

function cleanTrashPath(value: string) {
  return stripWrappingQuotes(
    value
      .replace(/^(?:the\s+)?(?:file|folder|directory|path)\s+/i, "")
      .replace(/\s+(?:to|into)\s+(?:the\s+)?(?:recycle\s+bin|trash)\.?$/i, "")
      .replace(
        /\s+(?:and|then)\s+(?:show|reveal|open|launch|locate)\s+(?:it|the\s+parent\s+folder|the\s+folder)\.?$/i,
        ""
      )
      .replace(/[.,;]+$/g, "")
  );
}

function parseWriteFileRequest(value: string): WriteFileRequest | null {
  const pathFirstMatch = value.match(
    /\b(?:create|write|save)\s+(?:a\s+|the\s+)?(?:file\s+)?(.+?)\s+(?:with\s+content|containing|contents?)\s*:?\s+([\s\S]+)$/i
  );
  if (pathFirstMatch?.[1] && pathFirstMatch[2]) {
    return {
      path: cleanWritePath(pathFirstMatch[1]),
      content: cleanWriteContent(pathFirstMatch[2]),
    };
  }

  const contentFirstMatch = value.match(
    /\b(?:write|save)\s+([\s\S]+?)\s+to\s+(?:a\s+|the\s+)?(?:file\s+)?(.+?)(?:\s+(?:and|then)\s+(?:open|launch)\s+(?:it|the\s+file|that\s+file))?\.?$/i
  );
  if (contentFirstMatch?.[1] && contentFirstMatch[2]) {
    return {
      path: cleanWritePath(contentFirstMatch[2]),
      content: cleanWriteContent(contentFirstMatch[1]),
    };
  }

  return null;
}

function shouldOpenAppendedFile(value: string) {
  return /\b(?:open|launch)\s+(?:it|the\s+file|that\s+file)\b|\b(?:append|add)\b[\s\S]*\b(?:and|then)\s+(?:open|launch)\b/i.test(
    value
  );
}

function parseAppendToFileRequest(value: string): AppendToFileRequest | null {
  const text = normalizeText(value);
  if (!/\b(?:append|add)(?=\s|:|$)/i.test(text) || !/\b(?:file|path)\b/i.test(text)) {
    return null;
  }

  const appendFirstQuotedMatch = text.match(
    /\b(?:append|add)(?:\s+(?:line|text|content|note|entry))?\s+["'`]([^"'`]*)["'`]\s+(?:to|into)\s+(?:the\s+)?(?:file\s+|path\s+)?["'`]([^"'`]+)["'`]/i
  );
  const appendFirstQuotedContent = appendFirstQuotedMatch?.[1] ?? "";
  const appendFirstQuotedPath = appendFirstQuotedMatch?.[2] ?? "";
  if (appendFirstQuotedPath && appendFirstQuotedContent.length) {
    return {
      path: cleanAppendPath(appendFirstQuotedPath),
      content: cleanAppendContent(appendFirstQuotedContent),
      openAfterAppend: shouldOpenAppendedFile(text),
    };
  }

  const fileFirstQuotedMatch = text.match(
    /\b(?:in|to|into)\s+(?:the\s+)?(?:file\s+|path\s+)?["'`]([^"'`]+)["'`][\s,]+(?:append|add)(?:\s+(?:line|text|content|note|entry))?\s+["'`]([^"'`]*)["'`]/i
  );
  const fileFirstQuotedPath = fileFirstQuotedMatch?.[1] ?? "";
  const fileFirstQuotedContent = fileFirstQuotedMatch?.[2] ?? "";
  if (fileFirstQuotedPath && fileFirstQuotedContent.length) {
    return {
      path: cleanAppendPath(fileFirstQuotedPath),
      content: cleanAppendContent(fileFirstQuotedContent),
      openAfterAppend: shouldOpenAppendedFile(text),
    };
  }

  const appendFirstMatch = text.match(
    /\b(?:append|add)(?:\s+(?:line|text|content|note|entry))?\s+([\s\S]+?)\s+(?:to|into)\s+(?:the\s+)?(?:file|path)\s+(.+?)(?:\s+(?:and|then)\s+(?:open|launch)\s+(?:it|the\s+file|that\s+file))?\.?$/i
  );
  if (appendFirstMatch?.[1] && appendFirstMatch[2]) {
    const content = cleanAppendContent(appendFirstMatch[1]);
    if (!content) {
      return null;
    }

    return {
      path: cleanAppendPath(appendFirstMatch[2]),
      content,
      openAfterAppend: shouldOpenAppendedFile(text),
    };
  }

  return null;
}

function shouldOpenReplacedFile(value: string) {
  return /\b(?:open|launch)\s+(?:it|the\s+file|that\s+file)\b|\b(?:replace|change|edit)\b[\s\S]*\b(?:and|then)\s+(?:open|launch)\b/i.test(
    value
  );
}

function shouldReplaceAll(value: string) {
  return /\b(?:replace\s+all|all\s+occurrences|every\s+occurrence|globally)\b/i.test(value);
}

function parseReplaceInFileRequest(value: string): ReplaceInFileRequest | null {
  const text = normalizeText(value);
  if (!/\b(?:replace|change|edit)(?=\s|:|$)/i.test(text) || !/\b(?:file|path)\b/i.test(text)) {
    return null;
  }

  const replaceFirstMatch = text.match(
    /\b(?:replace|change)\s+(?:all\s+)?["'`]([^"'`]+)["'`]\s+(?:with|to)\s+["'`]([^"'`]*)["'`]\s+in\s+(?:the\s+)?(?:file\s+|path\s+)?["'`]([^"'`]+)["'`]/i
  );
  if (replaceFirstMatch?.[1] && replaceFirstMatch[3]) {
    return {
      path: cleanReplacePath(replaceFirstMatch[3]),
      search: cleanReplaceText(replaceFirstMatch[1]),
      replacement: cleanReplaceText(replaceFirstMatch[2] ?? ""),
      replaceAll: shouldReplaceAll(text),
      openAfterReplace: shouldOpenReplacedFile(text),
    };
  }

  const fileFirstMatch = text.match(
    /\bin\s+(?:the\s+)?(?:file\s+|path\s+)?["'`]([^"'`]+)["'`][\s,]+(?:replace|change)\s+(?:all\s+)?["'`]([^"'`]+)["'`]\s+(?:with|to)\s+["'`]([^"'`]*)["'`]/i
  );
  if (fileFirstMatch?.[1] && fileFirstMatch[2]) {
    return {
      path: cleanReplacePath(fileFirstMatch[1]),
      search: cleanReplaceText(fileFirstMatch[2]),
      replacement: cleanReplaceText(fileFirstMatch[3] ?? ""),
      replaceAll: shouldReplaceAll(text),
      openAfterReplace: shouldOpenReplacedFile(text),
    };
  }

  return null;
}

function shouldOpenWrittenFile(value: string) {
  return /\b(?:open|launch)\s+(?:it|the\s+file|that\s+file)\b|\b(?:create|write|save)\b[\s\S]*\b(?:and|then)\s+(?:open|launch)\b/i.test(
    value
  );
}

function shouldOpenCreatedDirectory(value: string) {
  return /\b(?:open|launch)\s+(?:it|the\s+folder|that\s+folder|the\s+directory|that\s+directory)\b|\b(?:create|make|new)\b[\s\S]*\b(?:and|then)\s+(?:open|launch)\b/i.test(
    value
  );
}

function shouldOpenCopiedPath(value: string) {
  return /\b(?:open|launch)\s+(?:it|the\s+copy|that\s+copy|the\s+copied\s+(?:file|folder|directory))\b|\b(?:copy|duplicate)\b[\s\S]*\b(?:and|then)\s+(?:open|launch)\b/i.test(
    value
  );
}

function shouldOverwriteCopiedPath(value: string) {
  return /\b(?:overwrite|replace\s+(?:the\s+)?existing|force\s+(?:copy|overwrite))\b/i.test(value);
}

function shouldOpenMovedPath(value: string) {
  return /\b(?:open|launch)\s+(?:it|the\s+moved\s+(?:file|folder|directory)|the\s+renamed\s+(?:file|folder|directory)|the\s+new\s+path)\b|\b(?:move|rename)\b[\s\S]*\b(?:and|then)\s+(?:open|launch)\b/i.test(
    value
  );
}

function parseCopyPathRequest(value: string): CopyPathRequest | null {
  const text = normalizeText(value);
  if (
    !/\b(?:copy|duplicate)\s+(?:the\s+)?(?:(?:file|folder|directory|path)\b|["'`]|[a-z]:|\.{1,2}[\\/]|~?[\\/])/i.test(
      text
    ) ||
    /\bclipboard\b/i.test(text)
  ) {
    return null;
  }

  const quoted = quotedValues(text);
  let sourcePath = quoted[0] ? cleanCopyPath(quoted[0]) : "";
  let destinationPath = quoted[1] ? cleanCopyPath(quoted[1]) : "";

  if (!sourcePath || !destinationPath) {
    const match = text.match(
      /\b(?:copy|duplicate)\s+(?:the\s+)?(?:(?:file|folder|directory|path)\s+)?(.+?)\s+(?:to|into|as)\s+(.+?)(?:\s+(?:and|then)\s+(?:show|reveal|open|launch|locate)\s+(?:it|the\s+copy|the\s+copied\s+(?:file|folder|directory)|that\s+copy))?\.?$/i
    );
    if (match?.[1] && match[2]) {
      sourcePath = sourcePath || cleanCopyPath(match[1]);
      destinationPath = destinationPath || cleanCopyPath(match[2]);
    }
  }

  if (!sourcePath || !destinationPath) {
    return null;
  }

  const hasPathSignal =
    FILE_PATH_PATTERN.test(sourcePath) ||
    FILE_PATH_PATTERN.test(destinationPath) ||
    /\b(?:file|folder|directory|path)\b/i.test(text);
  if (!hasPathSignal) {
    return null;
  }

  return {
    sourcePath,
    destinationPath,
    overwrite: shouldOverwriteCopiedPath(text),
    openAfterCopy: shouldOpenCopiedPath(text),
  };
}

function parseMovePathRequest(value: string): MovePathRequest | null {
  const text = normalizeText(value);
  if (
    !/\b(?:move|rename)(?=\s|:|$)/i.test(text) ||
    /\b(?:mouse|cursor|pointer|window)\b/i.test(text) ||
    /\b(?:recycle\s+bin|trash)\b/i.test(text)
  ) {
    return null;
  }

  const quoted = quotedValues(text);
  let sourcePath = quoted[0] ? cleanMovePath(quoted[0]) : "";
  let destinationPath = quoted[1] ? cleanMovePath(quoted[1]) : "";

  if (!sourcePath || !destinationPath) {
    const match = text.match(
      /\b(?:move|rename)\s+(?:the\s+)?(?:(?:file|folder|directory|path)\s+)?(.+?)\s+(?:to|into|as)\s+(.+?)(?:\s+(?:and|then)\s+(?:show|reveal|open|launch|locate)\s+(?:it|the\s+moved\s+(?:file|folder|directory)|the\s+renamed\s+(?:file|folder|directory)|the\s+new\s+path))?\.?$/i
    );
    if (match?.[1] && match[2]) {
      sourcePath = sourcePath || cleanMovePath(match[1]);
      destinationPath = destinationPath || cleanMovePath(match[2]);
    }
  }

  if (!sourcePath || !destinationPath) {
    return null;
  }

  const hasPathSignal =
    FILE_PATH_PATTERN.test(sourcePath) ||
    FILE_PATH_PATTERN.test(destinationPath) ||
    /\b(?:file|folder|directory|path)\b/i.test(text);
  if (!hasPathSignal) {
    return null;
  }

  return {
    sourcePath,
    destinationPath,
    openAfterMove: shouldOpenMovedPath(text),
  };
}

function parseTrashPathRequest(value: string): TrashPathRequest | null {
  const text = normalizeText(value);
  const hasTrashVerb = /\b(?:trash|delete|remove)(?=\s|:|$)/i.test(text);
  const hasRecycleBinVerb =
    /\b(?:send|move)(?=\s|:|$)/i.test(text) &&
    /\b(?:recycle\s+bin|trash)\b/i.test(text);
  if (
    (!hasTrashVerb && !hasRecycleBinVerb) ||
    /\b(?:mouse|cursor|pointer|window)\b/i.test(text)
  ) {
    return null;
  }

  if (/\bmove(?=\s|:|$)/i.test(text) && !/\b(?:trash|recycle\s+bin)\b/i.test(text)) {
    return null;
  }

  const quoted = quotedValues(text);
  let targetPath = quoted[0] ? cleanTrashPath(quoted[0]) : "";

  if (!targetPath) {
    const trashVerbMatch = text.match(
      /\b(?:trash|delete|remove)\s+(?:the\s+)?(?:(?:file|folder|directory|path)\s+)?(.+?)(?:\s+(?:and|then)\s+(?:show|reveal|open|launch|locate)\s+(?:it|the\s+parent\s+folder|the\s+folder))?\.?$/i
    );
    const recycleBinMatch = text.match(
      /\b(?:send|move)\s+(?:the\s+)?(?:(?:file|folder|directory|path)\s+)?(.+?)\s+(?:to|into)\s+(?:the\s+)?(?:recycle\s+bin|trash)\.?$/i
    );
    targetPath = cleanTrashPath(trashVerbMatch?.[1] || recycleBinMatch?.[1] || "");
  }

  if (!targetPath) {
    return null;
  }

  const hasPathSignal =
    FILE_PATH_PATTERN.test(targetPath) ||
    quoted.length > 0 ||
    /\b(?:file|folder|directory|path|recycle\s+bin|trash)\b/i.test(text);
  if (!hasPathSignal) {
    return null;
  }

  return { path: targetPath };
}

function parseCreateDirectoryRequest(value: string): CreateDirectoryRequest | null {
  if (!/\b(?:create|make|new)\s+(?:a\s+|the\s+)?(?:new\s+)?(?:folder|directory|dir)\b/i.test(value)) {
    return null;
  }

  const pathLike = firstPathLikeValue(value);
  const quoted = firstQuotedValue(value);
  const directMatch = value.match(
    /\b(?:create|make|new)\s+(?:a\s+|the\s+)?(?:new\s+)?(?:folder|directory|dir)\s+(.+?)(?:\s+(?:and|then)\s+(?:show|reveal|open|launch|locate)\s+(?:it|the\s+folder|that\s+folder|the\s+directory|that\s+directory))?\.?$/i
  );
  const candidate = pathLike ?? quoted ?? directMatch?.[1] ?? "";
  const directoryPath = cleanDirectoryPath(candidate);
  if (!directoryPath) {
    return null;
  }

  return {
    path: directoryPath,
    openAfterCreate: shouldOpenCreatedDirectory(value),
  };
}

export function hasClickyDesktopOperatorIntent(userText: string | null | undefined) {
  const text = normalizeText(userText);
  if (!text || !CLICKY_DESKTOP_OPERATOR_PATTERN.test(text)) {
    return false;
  }

  const hasDesktopSignal =
    /\b(?:app|application|program|desktop|computer|pc|screen|screenshot|mouse|keyboard|click|type|clipboard)\b/i.test(
      text
    );
  const hasOnlyWebsiteSignal =
    BROWSER_OR_WEBSITE_ONLY_PATTERN.test(text) && !hasDesktopSignal;

  return !hasOnlyWebsiteSignal;
}

export function hasDirectDesktopWorkflowIntent(userText: string | null | undefined) {
  const text = normalizeText(userText);
  if (!text) {
    return false;
  }

  if (parseShellCommand(text)) {
    return true;
  }

  if (parseAppendToFileRequest(text)) {
    return true;
  }

  if (parseReplaceInFileRequest(text)) {
    return true;
  }

  if (parseWriteFileRequest(text)) {
    return true;
  }

  if (parseCreateDirectoryRequest(text)) {
    return true;
  }

  if (parseCopyPathRequest(text)) {
    return true;
  }

  if (parseTrashPathRequest(text)) {
    return true;
  }

  if (parseMovePathRequest(text)) {
    return true;
  }

  if (parseReadVisibleTextRequest(text)) {
    return true;
  }

  if (parseGetElementStateRequest(text)) {
    return true;
  }

  if (parseGetElementValueRequest(text)) {
    return true;
  }

  if (parseInvokeElementRequest(text)) {
    return true;
  }

  if (parseSetClipboardRequest(text) || parseGetClipboardRequest(text)) {
    return true;
  }

  if (
    parseTypeTextRequest(text) ||
    parseKeyPressRequest(text) ||
    parseClickRequest(text) ||
    parseClickElementRequest(text) ||
    parseTypeIntoElementRequest(text) ||
    parseSetElementValueRequest(text) ||
    parseSelectOptionRequest(text) ||
    parseSetToggleStateRequest(text) ||
    parseWaitForElementRequest(text) ||
    parseMoveMouseRequest(text) ||
    parseDragMouseRequest(text) ||
    parseMouseButtonRequests(text).length > 0 ||
    parseScrollRequest(text) ||
    parseListWindowsRequest(text) ||
    parseListUiElementsRequest(text) ||
    parseFocusWindowRequest(text) ||
    parseSetWindowStateRequest(text) ||
    parseCloseWindowRequest(text)
  ) {
    return true;
  }

  const pathLike = firstPathLikeValue(text);
  if (!pathLike) {
    return false;
  }

  return /\b(?:read|open|inspect|summari[sz]e|list|show|reveal|find|locate|write|create|save|append)\b/i.test(
    text
  );
}

export function buildClickyDesktopOperatorWorkflow(
  userText: string | null | undefined
): DesktopLaunchWorkflowInput {
  const text = normalizeText(userText);
  const shouldListWindows = parseListWindowsRequest(text);
  const target = shouldListWindows ? null : extractAppTargetFromOperatorText(text);
  const launchIntent = target ? buildDesktopLaunchIntentFromTarget(target) : null;
  const webTarget = extractWebTargetFromOperatorText(text);
  const appendRequest = parseAppendToFileRequest(text);
  const replaceRequest = parseReplaceInFileRequest(text);
  const writeRequest = parseWriteFileRequest(text);
  const createDirectoryRequest = parseCreateDirectoryRequest(text);
  const copyPathRequest = parseCopyPathRequest(text);
  const trashPathRequest = parseTrashPathRequest(text);
  const movePathRequest = parseMovePathRequest(text);
  const pathLike = firstPathLikeValue(text);
  const shellCommand = parseShellCommand(text);
  const shouldReadVisibleText = parseReadVisibleTextRequest(text);
  const getElementStateRequest = parseGetElementStateRequest(text);
  const getElementValueRequest = parseGetElementValueRequest(text);
  const invokeElementRequest = parseInvokeElementRequest(text);
  const setClipboardText = parseSetClipboardRequest(text);
  const shouldGetClipboard = parseGetClipboardRequest(text);
  const typeText = parseTypeTextRequest(text);
  const keyPress = parseKeyPressRequest(text);
  const clickRequest = parseClickRequest(text);
  const clickElementRequest = parseClickElementRequest(text);
  const typeIntoElementRequest = parseTypeIntoElementRequest(text);
  const setElementValueRequest = parseSetElementValueRequest(text);
  const selectOptionRequest = parseSelectOptionRequest(text);
  const setToggleStateRequest = parseSetToggleStateRequest(text);
  const waitForElementRequest = parseWaitForElementRequest(text);
  const moveMouseRequest = parseMoveMouseRequest(text);
  const dragMouseRequest = parseDragMouseRequest(text);
  const mouseButtonRequests = parseMouseButtonRequests(text);
  const scrollRequest = parseScrollRequest(text);
  const focusWindowRequest = parseFocusWindowRequest(text);
  const listUiElementsRequest = parseListUiElementsRequest(text);
  const setWindowStateRequest = parseSetWindowStateRequest(text);
  const shouldCloseWindow = parseCloseWindowRequest(text);
  const label = launchIntent?.label ?? "current app or desktop";
  const steps: DesktopLaunchWorkflowInput["steps"] = [];

  if (launchIntent?.kind === "app") {
    steps.push({
      id: "step_open_app",
      name: `Open ${launchIntent.label}`,
      action: launchIntent.action,
      timeout: 20000,
    });
    steps.push({
      id: "step_wait_for_app",
      name: "Wait for app",
      action: { type: "wait", ms: 2500 },
      timeout: 5000,
    });
  }

  if (webTarget) {
    steps.push({
      id: "step_open_browser_target",
      name: webTarget === DEFAULT_BROWSER_URL ? "Open browser" : "Open website",
      action: { type: "openPath", target: webTarget, wait: true },
      timeout: 15000,
    });
    steps.push({
      id: "step_wait_for_browser",
      name: "Wait for browser",
      action: { type: "wait", ms: 2500 },
      timeout: 5000,
    });
  }

  if (setClipboardText) {
    steps.push({
      id: "step_set_clipboard",
      name: "Set clipboard",
      action: { type: "setClipboard", text: setClipboardText },
      timeout: 5000,
    });
  }

  if (shouldGetClipboard) {
    steps.push({
      id: "step_get_clipboard",
      name: "Read clipboard",
      action: { type: "getClipboard" },
      timeout: 5000,
    });
  }

  if (shouldReadVisibleText) {
    steps.push({
      id: "step_read_visible_text",
      name: "Read visible text",
      action: { type: "readVisibleText", maxTextItems: 120 },
      timeout: 10000,
    });
  }

  if (getElementStateRequest) {
    steps.push({
      id: "step_get_element_state",
      name: `Get ${getElementStateRequest.text} state`,
      action: {
        type: "getElementState",
        text: getElementStateRequest.text,
        ...(getElementStateRequest.controlType
          ? { controlType: getElementStateRequest.controlType }
          : {}),
        timeoutMs: getElementStateRequest.timeoutMs,
      },
      timeout: Math.max(10000, getElementStateRequest.timeoutMs + 2000),
    });
  }

  if (getElementValueRequest) {
    steps.push({
      id: "step_get_element_value",
      name: `Read ${getElementValueRequest.text} value`,
      action: {
        type: "getElementValue",
        text: getElementValueRequest.text,
        controlType: getElementValueRequest.controlType,
        timeoutMs: getElementValueRequest.timeoutMs,
      },
      timeout: Math.max(10000, getElementValueRequest.timeoutMs + 2000),
    });
  }

  if (invokeElementRequest) {
    steps.push({
      id: "step_invoke_element",
      name: `Invoke ${invokeElementRequest.text}`,
      action: {
        type: "invokeElement",
        text: invokeElementRequest.text,
        ...(invokeElementRequest.controlType
          ? { controlType: invokeElementRequest.controlType }
          : {}),
        timeoutMs: invokeElementRequest.timeoutMs,
      },
      timeout: Math.max(10000, invokeElementRequest.timeoutMs + 2000),
    });
  }

  if (focusWindowRequest) {
    steps.push({
      id: "step_focus_window",
      name: `Focus ${focusWindowRequest.windowTitle}`,
      action: {
        type: "focusWindow",
        windowTitle: focusWindowRequest.windowTitle,
      },
      timeout: 10000,
    });
  }

  if (shouldListWindows) {
    steps.push({
      id: "step_list_windows",
      name: "List open windows",
      action: { type: "listWindows" },
      timeout: 10000,
    });
  }

  if (listUiElementsRequest) {
    steps.push({
      id: "step_list_ui_elements",
      name: "List visible UI elements",
      action: {
        type: "listUiElements",
        ...(listUiElementsRequest.controlType
          ? { controlType: listUiElementsRequest.controlType }
          : {}),
        maxElements: listUiElementsRequest.maxElements,
      },
      timeout: 10000,
    });
  }

  if (setWindowStateRequest) {
    steps.push({
      id: "step_set_window_state",
      name: `${setWindowStateRequest.state[0]?.toUpperCase()}${setWindowStateRequest.state.slice(1)} window`,
      action: {
        type: "setWindowState",
        state: setWindowStateRequest.state,
        ...(setWindowStateRequest.windowTitle
          ? { windowTitle: setWindowStateRequest.windowTitle }
          : {}),
      },
      timeout: 10000,
    });
  }

  if (waitForElementRequest) {
    steps.push({
      id: "step_wait_for_element",
      name: `Wait for ${waitForElementRequest.text}`,
      action: {
        type: "waitForElement",
        text: waitForElementRequest.text,
        ...(waitForElementRequest.controlType
          ? { controlType: waitForElementRequest.controlType }
          : {}),
        timeoutMs: waitForElementRequest.timeoutMs,
      },
      timeout: Math.max(10000, waitForElementRequest.timeoutMs + 2000),
    });
  }

  if (typeIntoElementRequest) {
    steps.push({
      id: "step_type_into_element",
      name: `Type into ${typeIntoElementRequest.text}`,
      action: {
        type: "typeIntoElement",
        text: typeIntoElementRequest.text,
        value: typeIntoElementRequest.value,
        controlType: typeIntoElementRequest.controlType,
        clear: typeIntoElementRequest.clear,
      },
      timeout: Math.max(8000, typeIntoElementRequest.value.length * 100),
    });
  }

  if (setElementValueRequest) {
    steps.push({
      id: "step_set_element_value",
      name: `Set ${setElementValueRequest.text}`,
      action: {
        type: "setElementValue",
        text: setElementValueRequest.text,
        value: setElementValueRequest.value,
        controlType: setElementValueRequest.controlType,
        timeoutMs: setElementValueRequest.timeoutMs,
      },
      timeout: Math.max(10000, setElementValueRequest.timeoutMs + 2000),
    });
  }

  if (selectOptionRequest) {
    steps.push({
      id: "step_select_option",
      name: `Select ${selectOptionRequest.option}`,
      action: {
        type: "selectOption",
        option: selectOptionRequest.option,
        text: selectOptionRequest.text,
        controlType: selectOptionRequest.controlType,
      },
      timeout: 10000,
    });
  }

  if (setToggleStateRequest) {
    steps.push({
      id: "step_set_toggle_state",
      name: `${setToggleStateRequest.state === "toggle" ? "Toggle" : "Set"} ${setToggleStateRequest.text}`,
      action: {
        type: "setToggleState",
        text: setToggleStateRequest.text,
        state: setToggleStateRequest.state,
        controlType: setToggleStateRequest.controlType,
      },
      timeout: 10000,
    });
  }

  if (typeText) {
    steps.push({
      id: "step_type_text",
      name: "Type text",
      action: { type: "type", text: typeText, delay: 20 },
      timeout: Math.max(5000, typeText.length * 80),
    });
  }

  if (keyPress) {
    steps.push({
      id: "step_key_press",
      name: `Press ${keyPress.key}`,
      action: {
        type: "keyPress",
        key: keyPress.key,
        ...(keyPress.modifiers ? { modifiers: keyPress.modifiers } : {}),
      },
      timeout: 5000,
    });
  }

  if (moveMouseRequest) {
    steps.push({
      id: "step_move_mouse",
      name: "Move cursor",
      action: { type: "moveMouse", ...moveMouseRequest },
      timeout: 5000,
    });
  }

  if (dragMouseRequest) {
    steps.push({
      id: "step_drag_mouse",
      name: "Drag cursor",
      action: {
        type: "dragMouse",
        ...(dragMouseRequest.from
          ? {
              fromX: dragMouseRequest.from.x,
              fromY: dragMouseRequest.from.y,
            }
          : {}),
        toX: dragMouseRequest.to.x,
        toY: dragMouseRequest.to.y,
        button: dragMouseRequest.button,
        durationMs: 450,
        steps: 24,
      },
      timeout: 8000,
    });
  }

  for (const mouseButtonRequest of mouseButtonRequests) {
    steps.push({
      id: mouseButtonRequest.type === "mouseDown" ? "step_mouse_down" : "step_mouse_up",
      name: mouseButtonRequest.type === "mouseDown" ? "Hold mouse button" : "Release mouse button",
      action: {
        type: mouseButtonRequest.type,
        button: mouseButtonRequest.button,
      },
      timeout: 5000,
    });
  }

  if (clickRequest) {
    steps.push({
      id: "step_click",
      name: clickRequest.double
        ? "Double-click"
        : clickRequest.button === "right"
          ? "Right-click"
          : clickRequest.button === "middle"
            ? "Middle-click"
            : "Click",
      action: { type: "click", ...clickRequest },
      timeout: 5000,
    });
  }

  if (clickElementRequest) {
    steps.push({
      id: "step_click_element",
      name: `Click ${clickElementRequest.text}`,
      action: {
        type: "clickElement",
        text: clickElementRequest.text,
        ...(clickElementRequest.controlType
          ? { controlType: clickElementRequest.controlType }
          : {}),
        button: clickElementRequest.button,
        double: clickElementRequest.double,
      },
      timeout: 10000,
    });
  }

  if (scrollRequest) {
    steps.push({
      id: "step_scroll",
      name: `Scroll ${scrollRequest.direction}`,
      action: { type: "scroll", ...scrollRequest },
      timeout: 5000,
    });
  }

  if (shouldCloseWindow) {
    steps.push({
      id: "step_close_window",
      name: "Close window",
      action: { type: "closeWindow", force: true },
      timeout: 5000,
    });
  }

  if (appendRequest) {
    steps.push({
      id: "step_append_to_file",
      name: "Append to file",
      action: {
        type: "appendToFile",
        path: appendRequest.path,
        content: appendRequest.content,
        backup: true,
        appendNewline: true,
        revealAfterAppend: true,
        openAfterAppend: appendRequest.openAfterAppend,
      },
      timeout: 10000,
    });
  } else if (replaceRequest) {
    steps.push({
      id: "step_replace_in_file",
      name: "Replace text in file",
      action: {
        type: "replaceInFile",
        path: replaceRequest.path,
        search: replaceRequest.search,
        replacement: replaceRequest.replacement,
        replaceAll: replaceRequest.replaceAll,
        backup: true,
        revealAfterReplace: true,
        openAfterReplace: replaceRequest.openAfterReplace,
      },
      timeout: 10000,
    });
  } else if (writeRequest) {
    steps.push({
      id: "step_write_file",
      name: "Write file",
      action: {
        type: "writeFile",
        path: writeRequest.path,
        content: writeRequest.content,
        revealAfterWrite: true,
        openAfterWrite: shouldOpenWrittenFile(text),
      },
      timeout: 10000,
    });
  } else if (copyPathRequest) {
    steps.push({
      id: "step_copy_path",
      name: "Copy path",
      action: {
        type: "copyPath",
        sourcePath: copyPathRequest.sourcePath,
        destinationPath: copyPathRequest.destinationPath,
        overwrite: copyPathRequest.overwrite,
        revealAfterCopy: true,
        openAfterCopy: copyPathRequest.openAfterCopy,
      },
      timeout: 30000,
    });
  } else if (trashPathRequest) {
    steps.push({
      id: "step_trash_path",
      name: "Move to trash",
      action: {
        type: "trashPath",
        path: trashPathRequest.path,
      },
      timeout: 30000,
    });
  } else if (movePathRequest) {
    steps.push({
      id: "step_move_path",
      name: "Move path",
      action: {
        type: "movePath",
        sourcePath: movePathRequest.sourcePath,
        destinationPath: movePathRequest.destinationPath,
        revealAfterMove: true,
        openAfterMove: movePathRequest.openAfterMove,
      },
      timeout: 30000,
    });
  } else if (createDirectoryRequest) {
    steps.push({
      id: "step_create_directory",
      name: "Create folder",
      action: {
        type: "createDirectory",
        path: createDirectoryRequest.path,
        revealAfterCreate: true,
        openAfterCreate: createDirectoryRequest.openAfterCreate,
      },
      timeout: 10000,
    });
  } else if (pathLike && /\b(?:list|show)\s+(?:the\s+)?(?:folder|directory|files)\b/i.test(text)) {
    steps.push({
      id: "step_list_directory",
      name: "List directory",
      action: { type: "listDirectory", path: pathLike },
      timeout: 10000,
    });
  } else if (pathLike && /\b(?:read|open|inspect|summari[sz]e)\s+(?:the\s+)?(?:file|text|log|document)\b/i.test(text)) {
    steps.push({
      id: "step_read_file",
      name: "Read file",
      action: { type: "readFile", path: pathLike },
      timeout: 10000,
    });
  } else if (pathLike && /\b(?:reveal|show|find|locate)\b/i.test(text)) {
    steps.push({
      id: "step_reveal_path",
      name: "Reveal path",
      action: { type: "revealPath", target: pathLike },
      timeout: 5000,
    });
  }

  if (shellCommand) {
    steps.push({
      id: "step_shell_command",
      name: "Run command",
      action: { type: "shellCommand", command: shellCommand },
      timeout: 30000,
    });
  }

  steps.push({
    id: "step_capture_initial_state",
    name: "Capture screen",
    action: { type: "screenshot", analyze: false },
    timeout: 5000,
  });

  steps.push({
    id: "step_pause_for_review",
    name: "Pause for review",
    action: { type: "wait", ms: 1000 },
    timeout: 3000,
  });

  steps.push({
    id: "step_capture_final_state",
    name: "Capture final screen",
    action: { type: "screenshot", analyze: false },
    timeout: 5000,
  });

  return {
    name: launchIntent?.kind === "app" ? `Maria operate ${launchIntent.label}` : "Maria inspect desktop",
    description: [
      `Maria desktop operator request: ${text || "Inspect the current app or desktop."}`,
      `Target: ${label}${webTarget ? `; browser target: ${webTarget}` : ""}.`,
      "Open the target app and browser target when identified, capture visible state, and return evidence to the user.",
      "Do not type secrets, submit purchases, send messages, delete data, change account settings, or perform destructive actions unless the user explicitly approves that exact final action.",
      "If more app interaction is needed after the screenshots, ask for the next approved step.",
    ].join(" "),
    steps,
  };
}

export function buildDirectDesktopWorkflow(
  userText: string | null | undefined
): DesktopLaunchWorkflowInput {
  const workflow = buildClickyDesktopOperatorWorkflow(userText);
  const primaryActionType =
    workflow.steps.find(
      (step) => step.action.type !== "screenshot" && step.action.type !== "wait"
    )?.action.type ?? workflow.steps[0]?.action.type;
  const name =
    primaryActionType === "shellCommand"
      ? "Run desktop command"
      : primaryActionType === "readVisibleText"
        ? "Read desktop visible text"
        : primaryActionType === "getElementState"
          ? "Get desktop element state"
          : primaryActionType === "getElementValue"
            ? "Read desktop field value"
          : primaryActionType === "invokeElement"
            ? "Invoke desktop element"
          : primaryActionType === "readFile"
            ? "Read desktop file"
            : primaryActionType === "writeFile"
              ? "Write desktop file"
          : primaryActionType === "appendToFile"
            ? "Append desktop file"
            : primaryActionType === "replaceInFile"
              ? "Edit desktop file"
              : primaryActionType === "copyPath"
                ? "Copy desktop path"
                : primaryActionType === "trashPath"
                  ? "Trash desktop path"
                  : primaryActionType === "movePath"
                    ? "Move desktop path"
                    : primaryActionType === "createDirectory"
                      ? "Create desktop folder"
                      : primaryActionType === "listDirectory"
                        ? "List desktop folder"
                        : primaryActionType === "revealPath"
                          ? "Reveal desktop path"
                          : primaryActionType === "setClipboard"
                            ? "Set desktop clipboard"
                            : primaryActionType === "getClipboard"
                              ? "Read desktop clipboard"
                              : primaryActionType === "type"
                                ? "Type on desktop"
                                : primaryActionType === "keyPress"
                                  ? "Press desktop key"
                                : primaryActionType === "click"
                                  ? "Click desktop"
                                  : primaryActionType === "clickElement"
                                  ? "Click desktop element"
                                  : primaryActionType === "typeIntoElement"
                                    ? "Type into desktop field"
                                    : primaryActionType === "setElementValue"
                                      ? "Set desktop field value"
                                      : primaryActionType === "selectOption"
                                        ? "Select desktop option"
                                        : primaryActionType === "setToggleState"
                                          ? "Set desktop toggle"
                                          : primaryActionType === "waitForElement"
                                            ? "Wait for desktop element"
                                            : primaryActionType === "moveMouse"
                                              ? "Move desktop cursor"
                                              : primaryActionType === "dragMouse"
                                                ? "Drag desktop cursor"
                                                : primaryActionType === "mouseDown" || primaryActionType === "mouseUp"
                                                  ? "Use desktop mouse"
                                                  : primaryActionType === "scroll"
                                                    ? "Scroll desktop"
                                                    : primaryActionType === "listWindows"
                                                      ? "List desktop windows"
                                                      : primaryActionType === "listUiElements"
                                                        ? "List desktop UI elements"
                                                        : primaryActionType === "focusWindow"
                                                          ? "Focus desktop window"
                                                          : primaryActionType === "setWindowState"
                                                            ? "Change desktop window state"
                                                            : primaryActionType === "closeWindow"
                                                              ? "Close desktop window"
                                                              : "Desktop workflow";
  const text = normalizeText(userText);

  return {
    ...workflow,
    name,
    description: [
      `Desktop workflow request: ${text || "Run the requested desktop workflow."}`,
      "Prepare the requested file, folder, path, app, browser, or shell-command workflow and return the result or evidence to the user.",
      "Do not type secrets, submit purchases, send messages, delete data, change account settings, or perform destructive actions unless the user explicitly approves that exact final action.",
      "If more context is needed before execution, ask for the missing path, content, command, or target first.",
    ].join(" "),
  };
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
