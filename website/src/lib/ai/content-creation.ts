export type ContentCreationIntent = {
  kind: "social" | "longform" | "script" | "ad" | "general";
  needsCurrentResearch: boolean;
};

const CONTENT_ACTION_PATTERN =
  /\b(?:make|create|generate|produce|draft|write|compose|prepare|plan|outline|rewrite|improve|fix)\b/i;
const CONTENT_TARGET_PATTERN =
  /\b(?:content|caption|captions|post|posts|thread|tweet|tweets|x post|linkedin|instagram|tiktok|youtube|shorts?|reels?|script|hook|hooks|blog|article|newsletter|ad\s*copy|copywriting|landing\s+page\s+copy|headline|headlines|ugc|carousel|storyboard|content\s+calendar|video\s+idea|video\s+ideas)\b/i;
const DEBUG_CONTEXT_PATTERN =
  /\b(?:bug|code|compile|typescript|route|api|component|fix|debug|error|issue|not working|broken|regression|test)\b/i;
const CURRENT_RESEARCH_PATTERN =
  /\b(?:latest|current|recent|today|this week|this month|trend|trends|news|stats?|statistics|benchmark|benchmarks|competitor|competitors|market|citation|citations|source|sources|research)\b/i;

function normalizeContentText(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function isEngineeringRequest(text: string) {
  return DEBUG_CONTEXT_PATTERN.test(text) && /\b(?:ai|model|prompt|content|generation|tool|route|code)\b/i.test(text);
}

function classifyContentKind(text: string): ContentCreationIntent["kind"] {
  if (/\b(?:script|storyboard|video\s+idea|video\s+ideas|hook|hooks)\b/i.test(text)) {
    return "script";
  }

  if (/\b(?:caption|post|thread|tweet|linkedin|instagram|tiktok|youtube|shorts?|reels?|carousel)\b/i.test(text)) {
    return "social";
  }

  if (/\b(?:ad\s*copy|copywriting|landing\s+page\s+copy|headline|headlines)\b/i.test(text)) {
    return "ad";
  }

  if (/\b(?:blog|article|newsletter)\b/i.test(text)) {
    return "longform";
  }

  return "general";
}

export function detectContentCreationIntent(
  userText: string | null | undefined
): ContentCreationIntent | null {
  const text = normalizeContentText(userText);
  if (!text || isEngineeringRequest(text)) {
    return null;
  }

  if (!CONTENT_ACTION_PATTERN.test(text) || !CONTENT_TARGET_PATTERN.test(text)) {
    return null;
  }

  return {
    kind: classifyContentKind(text),
    needsCurrentResearch: CURRENT_RESEARCH_PATTERN.test(text),
  };
}

export function buildContentCreationSystemAddition(
  intent: ContentCreationIntent
) {
  const formatGuidance =
    intent.kind === "social"
      ? "- For social content, lead with publish-ready copy. Add variants, hooks, CTA options, and platform notes only when useful."
      : intent.kind === "script"
        ? "- For creator scripts, lead with the finished script or outline. Keep scenes, hooks, beats, and CTAs practical for production."
        : intent.kind === "ad"
          ? "- For ad copy, lead with the finished copy. Keep claims conservative, action-oriented, and easy to verify."
          : intent.kind === "longform"
            ? "- For long-form content, lead with a usable draft or outline, then add only the most useful editing notes."
            : "- Lead with the usable content artifact, then add concise options or next steps only when useful.";

  const researchGuidance = intent.needsCurrentResearch
    ? "- This content request mentions current facts, trends, statistics, competitors, citations, or research. Do not invent those details. Use provided research/tool context when available; otherwise say what needs verification or mark the claim as [NEEDS: source/current data]."
    : "- Do not add external facts, statistics, dates, market claims, customer quotes, case studies, or citations unless they are present in the chat, saved context, or tool results.";

  return [
    "CONTENT CREATION QUALITY MODE:",
    "- Use only the visible chat, saved memory, project/profile context, connected-data results, and tool/research outputs as factual ground truth.",
    "- Never fabricate brand facts, product specs, pricing, deadlines, availability, integrations, performance numbers, testimonials, customer names, legal claims, medical claims, financial claims, or platform-policy details.",
    "- If a useful detail is missing, either ask one focused follow-up before drafting or use an explicit placeholder like [NEEDS: audience], [NEEDS: offer], or [NEEDS: proof]. Do not hide guesses inside confident copy.",
    "- If you make assumptions to keep momentum, label them briefly under 'Assumptions to review'.",
    formatGuidance,
    researchGuidance,
  ].join("\n");
}
