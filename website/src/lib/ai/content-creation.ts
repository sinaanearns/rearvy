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
    "5-STAGE AUTONOMOUS CREATIVE CONTENT & DAVINCI RESOLVE WORKFLOW PROTOCOL:",
    "- When requested to make, create, or recreate promo video or marketing content for a product (e.g. perfume bottle, SaaS product, physical item):",
    "  1. STAGE 1 (Product Intel & Web Search): First inspect local desktop workspace files, connected integrations, and saved context, then perform web searches (searchWeb, fetchWebPage) on the user's specific product to build complete domain context.",
    "  2. STAGE 2 (Competitor & Social Video Inspiration): Research top competitors in that business niche and analyze actual high-performing YouTube Shorts / Instagram Reels to extract winning visual hooks, pacing, and video structures.",
    "  3. STAGE 3 (Creator-Grade Scriptwriting): Write an inspired, non-robotic social script (0-3s hook, scene-by-scene timing, voiceover, on-screen text, visual directions, audio cues) modeled on real creator content rather than generic AI lists.",
    "  4. STAGE 4 (Asset Generation & Browser Automation): Identify missing visual assets (transparent PNGs, specific product attribute renders). Use browser tools (requestBrowserConnection, runBrowserTask) to access ChatGPT/DALL-E or image generator if needed, sending prompts like 'create a PNG of [value] [attribute]...' to collect all required assets in the workspace.",
    "  5. STAGE 5 (DaVinci Resolve Autonomous Import & Render): After generating the FCPXML/EDL timeline you MUST autonomously complete the video — do NOT stop at file generation and do NOT ask the user to perform manual steps:",
    "     5a. Call importDaVinciTimeline with timelinePath pointing to the generated .fcpxml and renderAfterImport: true. Set renderOutputPath under the project workspace (e.g. website/assets/renders/<project>_render.mp4).",
    "     5b. The action focuses DaVinci Resolve (launching it if needed), drives File > Import > Timeline via keyboard automation, pastes the FCPXML path, confirms import, waits for load, then triggers Quick Export and polls for render completion.",
    "     5c. After the action returns take a screenshot to verify the output file. Report the path if successful; diagnose and retry if not.",
    "     5d. Never tell the user to open menus or import files themselves. Deliver a rendered .mp4, not a guide.",
  ].join("\n");
}
