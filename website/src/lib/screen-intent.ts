const CURLY_APOSTROPHES_PATTERN = /[\u2018\u2019\u201A\u201B]/g;
const CURLY_QUOTES_PATTERN = /[\u201C\u201D\u201E\u201F]/g;

const SCREEN_READ_INTENT_PATTERNS: RegExp[] = [
  /^(?:please\s+)?(?:screenshot|screen shot|screen capture|screen snapshot)$/,
  /\b(?:take|capture|get|grab|make)\s+(?:a\s+)?(?:(?:desktop|screen|current|visible|active)\s+)?(?:screenshot|screen shot|screen capture|screen snapshot|snapshot)\b/,
  /\b(?:screenshot|screen shot|screen capture|screen snapshot|snapshot)\b.*\b(?:analy[sz]e|read|describe|inspect|tell\s+me|what\s+it\s+says|what'?s\s+on|what\s+is\s+on)\b/,
  /\b(?:analy[sz]e|read|describe|inspect|look\s+at|scan|summari[sz]e)\s+(?:(?:my|the|this|current|visible|active)\s+)?(?:screen|page|window|desktop|app|tab)\b/,
  /\b(?:analy[sz]e|read|describe|inspect|look\s+at|scan|see)\s+(?:everything\s+(?:on|in)\s+)?(?:(?:my|the|this|current|visible|active)\s+)?(?:device|computer|pc|monitor|display)\b/,
  /\b(?:what'?s|what\s+is)\s+on\s+(?:(?:my|the|this|current|visible|active)\s+)?(?:screen|page|window|desktop|app|tab)\b/,
  /\b(?:what'?s|what\s+is)\s+on\s+(?:(?:my|the|this|current|visible|active)\s+)?(?:device|computer|pc|monitor|display)\b/,
  /\bwhat\s+does\s+(?:my|the|this|current|visible|active)\s+(?:screen|page|window|desktop|app|tab)\s+(?:say|show|showing|display|displaying|contain)\b/,
  /\bwhat\s+does\s+(?:my|the|this|current|visible|active)\s+(?:device|computer|pc|monitor|display)\s+(?:say|show|showing|display|displaying|contain)\b/,
  /\bwhat\s+(?:(?:do|can)\s+you\s+see|you\s+(?:see|can\s+see))\s+(?:on|in)\s+(?:(?:my|the|this|current|visible|active)\s+)?(?:screen|page|window|desktop|app|tab|device|computer|pc|monitor|display)\b/,
  /^(?:what|which)\s+(?:app|application|program|window|page|tab)\s+(?:do\s+)?you\s+(?:see|can\s+see)(?:\s+(?:now|right\s+now|here))?\??$/,
  /^(?:tell\s+me\s+)?what\s+(?:(?:do|can)\s+you\s+see|you\s+(?:see|can\s+see))(?:\s+(?:now|right\s+now|here))?\??$/,
  /\btell\s+me\s+what\s+(?:is\s+)?visible\b/,
  /\b(?:read|analy[sz]e|describe|inspect)\s+(?:the\s+)?(?:visible|current|active)\s+(?:page|screen|window|tab)\b/,
  /\b(?:take|capture|get|grab|make)\s+(?:a\s+)?(?:screenshot|snapshot|screen shot|screen capture)\s+of\s+([a-z0-9_\-\s.]+)/i,
  /\b(?:analy[sz]e|read|describe|inspect|look\s+at|scan|check)\s+(?:the\s+)?(?:app|application|window|program)?\s*([a-z0-9_\-\s]+)\s+(?:in\s+the\s+background|bg)?\b/i,
];

export function extractTargetAppFromScreenIntent(value: string | null | undefined): string | null {
  const text = normalizeScreenIntentText(value);
  if (!text) return null;

  // Match "screenshot of [App Name]"
  const matchOf = text.match(/\b(?:screenshot|snapshot|screen shot|screen capture)\s+of\s+([a-z0-9_\-\s]+?)(?:\s+(?:in\s+the\s+background|bg|and|to|with)|\s*$)/i);
  if (matchOf && matchOf[1]) {
    const appName = matchOf[1].replace(/^(?:the|my|a|an)\s+/i, "").trim();
    if (appName && !["screen", "desktop", "page", "window", "display", "monitor", "device", "computer"].includes(appName)) {
      return appName;
    }
  }

  // Match "inspect [App Name] in the background" / "check [App Name]"
  const matchTarget = text.match(/\b(?:analy[sz]e|read|describe|inspect|look\s+at|scan|check|capture)\s+(?:the\s+)?(?:app|application|window|program)?\s*([a-z0-9_\-\s]+?)\s+(?:in\s+the\s+background|bg)\b/i);
  if (matchTarget && matchTarget[1]) {
    const appName = matchTarget[1].replace(/^(?:the|my|a|an)\s+/i, "").trim();
    if (appName && !["screen", "desktop", "page", "window", "display", "monitor", "device", "computer"].includes(appName)) {
      return appName;
    }
  }

  return null;
}

export function normalizeScreenIntentText(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(CURLY_APOSTROPHES_PATTERN, "'")
    .replace(CURLY_QUOTES_PATTERN, '"')
    .replace(/\bu\b/g, "you")
    .replace(/\bseel\b/g, "see")
    .replace(/\b(?:devive|devuce|deivce)\b/g, "device")
    .replace(/\b(?:compter|coputer|computor)\b/g, "computer")
    .replace(/\bscrenshot\b/g, "screenshot")
    .replace(/\bscren\s*shot\b/g, "screen shot")
    .replace(/\bscreen-shot\b/g, "screen shot")
    .replace(/\bscreen\s+grab\b/g, "screenshot")
    .replace(/\s+/g, " ")
    .trim();
}

export function isScreenReadIntent(value: string | null | undefined) {
  const text = normalizeScreenIntentText(value);
  if (!text) {
    return false;
  }

  return SCREEN_READ_INTENT_PATTERNS.some((pattern) => pattern.test(text));
}

export function detectScreenIntent(value: string | null | undefined) {
  const isScreenRead = isScreenReadIntent(value);
  const targetApp = extractTargetAppFromScreenIntent(value);
  return {
    isScreenRead: isScreenRead || Boolean(targetApp),
    targetApp,
  };
}

export const isScreenAnalysisRequest = isScreenReadIntent;
