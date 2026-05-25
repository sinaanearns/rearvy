export function normalizeScreenIntentText(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
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

  return [
    /^(?:please\s+)?(?:screenshot|screen shot|screen capture|screen snapshot)$/,
    /\b(?:take|capture|get|grab|make)\s+(?:a\s+)?(?:(?:desktop|screen|current|visible|active)\s+)?(?:screenshot|screen shot|screen capture|screen snapshot|snapshot)\b/,
    /\b(?:screenshot|screen shot|screen capture|screen snapshot|snapshot)\b.*\b(?:analy[sz]e|read|describe|inspect|tell\s+me|what\s+it\s+says|what'?s\s+on|what\s+is\s+on)\b/,
    /\b(?:analy[sz]e|read|describe|inspect|look\s+at|scan|summari[sz]e)\s+(?:(?:my|the|this|current|visible|active)\s+)?(?:screen|page|window|desktop|app|tab)\b/,
    /\b(?:what'?s|what\s+is)\s+on\s+(?:(?:my|the|this|current|visible|active)\s+)?(?:screen|page|window|desktop|app|tab)\b/,
    /\bwhat\s+does\s+(?:my|the|this|current|visible|active)\s+(?:screen|page|window|desktop|app|tab)\s+(?:say|show|showing|display|displaying|contain)\b/,
    /\b(?:tell\s+me\s+)?what\s+(?:do\s+)?you\s+(?:see|can\s+see)\b/,
    /\btell\s+me\s+what\s+(?:is\s+)?visible\b/,
    /\b(?:read|analy[sz]e|describe|inspect)\s+(?:the\s+)?(?:visible|current|active)\s+(?:page|screen|window|tab)\b/,
  ].some((pattern) => pattern.test(text));
}

export const isScreenAnalysisRequest = isScreenReadIntent;
