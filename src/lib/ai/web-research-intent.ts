export type WebResearchBusinessType =
  | "shopify"
  | "content_creator"
  | "agency"
  | "other"
  | null
  | undefined;

export type WebResearchProfileContext = {
  businessName?: string | null;
  businessType?: WebResearchBusinessType;
};

export type WebResearchProjectContext = {
  name?: string | null;
  description?: string | null;
};

export type WebResearchMemoryContext = {
  content?: string | null;
  importance?: number | null;
  memoryType?: string | null;
};

export type PlanWebResearchInput = {
  userText: string;
  profile?: WebResearchProfileContext;
  project?: WebResearchProjectContext | null;
  memories?: WebResearchMemoryContext[];
};

export type WebResearchPlan = {
  intentMatched: boolean;
  mode: "none" | "clarify" | "search";
  candidateQueries: string[];
  clarificationQuestion: string | null;
  normalizedPrompt: string;
  topicSummary: string | null;
  strategy: "competitor" | "market" | "general";
};

const GENERIC_STOPWORDS = new Set([
  "a",
  "an",
  "about",
  "access",
  "acsees",
  "and",
  "are",
  "best",
  "browse",
  "can",
  "check",
  "current",
  "find",
  "for",
  "from",
  "get",
  "hello",
  "hey",
  "hi",
  "i",
  "in",
  "internet",
  "latest",
  "look",
  "me",
  "my",
  "news",
  "of",
  "ok",
  "okay",
  "online",
  "out",
  "please",
  "public",
  "recent",
  "research",
  "search",
  "show",
  "tell",
  "the",
  "to",
  "u",
  "up",
  "web",
  "what",
  "who",
  "would",
  "you",
]);

const GENERIC_EXTERNAL_TERMS = new Set([
  "alternative",
  "alternatives",
  "competition",
  "competitor",
  "competitors",
  "example",
  "examples",
  "industry",
  "market",
  "rival",
  "rivals",
  "trend",
  "trends",
]);

const KEYWORD_RULES: Array<{ canonical: string; pattern: RegExp }> = [
  { canonical: "shopify", pattern: /\bshopify\b/i },
  { canonical: "ecommerce", pattern: /\be-?commerce\b|\bonline store(s)?\b/i },
  { canonical: "analytics", pattern: /\banalytics\b|\banalysis\b|\binsights\b/i },
  { canonical: "business intelligence", pattern: /\bbusiness intelligence\b/i },
  { canonical: "business analysis", pattern: /\bbusiness analysis\b/i },
  { canonical: "ai", pattern: /\bai\b|\bartificial intelligence\b|\bai[- ]driven\b/i },
  { canonical: "saas", pattern: /\bsaas\b|\bsoftware\b/i },
  { canonical: "customer", pattern: /\bcustomer(s)?\b|\bretention\b|\bbehavior\b/i },
  { canonical: "revenue", pattern: /\brevenue\b|\bconversion(s)?\b|\bprofit(s)?\b/i },
  { canonical: "store", pattern: /\bstore(s)?\b/i },
];

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeForMatching(value: string): string {
  return normalizeWhitespace(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .replace(/-/g, " ")
  );
}

function stripLeadingBoilerplate(value: string): string {
  let result = value;

  const patterns = [
    /^(can u|can you|could you|would you|will you)\s+/i,
    /^(please|hey|hi|hello|yo|ok|okay)\s+/i,
  ];

  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of patterns) {
      const next = result.replace(pattern, "");
      if (next !== result) {
        result = next;
        changed = true;
      }
    }
  }

  return result;
}

function stripResearchBoilerplate(value: string): string {
  const normalized = normalizeWhitespace(stripLeadingBoilerplate(value));

  return normalizeWhitespace(
    normalized
      .replace(/\b(search the web|browse the web|search web|browse web)\b/gi, " ")
      .replace(/\b(look it up|look up|google|research|browse|search|check|see)\b/gi, " ")
      .replace(/\b(access|acsees|find)\b/gi, " ")
      .replace(/\b(the )?(web|internet|online)\b/gi, " ")
      .replace(/\b(for me|to me|for us|please)\b/gi, " ")
      .replace(/\b(who are|what are|show me|tell me)\b/gi, " ")
      .replace(/[?.,!/]+/g, " ")
      .replace(/\s+/g, " ")
  );
}

function tokenize(value: string): string[] {
  return normalizeForMatching(value)
    .split(" ")
    .filter(Boolean);
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function extractSpecificTopic(value: string): string {
  const cleaned = stripResearchBoilerplate(value);
  const tokens = tokenize(cleaned).filter(
    (token) =>
      !GENERIC_STOPWORDS.has(token) && !GENERIC_EXTERNAL_TERMS.has(token)
  );

  return normalizeWhitespace(tokens.join(" "));
}

function isCompetitorRequest(normalized: string): boolean {
  return /\b(competition|competitor|competitors|rival|rivals|alternative|alternatives)\b/.test(
    normalized
  );
}

function isMarketResearchRequest(normalized: string): boolean {
  return /\b(market|industry|trend|trends|news|public example|public examples)\b/.test(
    normalized
  );
}

function hasWebReference(normalized: string): boolean {
  return /\b(web|internet|online)\b/.test(normalized);
}

function hasResearchAction(normalized: string): boolean {
  return /\b(search|browse|google|research|look up|look it up|find|access|acsees)\b/.test(
    normalized
  );
}

function hasTimeSensitiveSignal(normalized: string): boolean {
  return /\b(latest|current|recent|today|this week|this month)\b/.test(
    normalized
  );
}

function getBusinessTypeHints(
  businessType: WebResearchBusinessType
): string[] {
  switch (businessType) {
    case "shopify":
      return ["shopify", "ecommerce", "stores"];
    case "content_creator":
      return ["creator", "social media", "audience analytics"];
    case "agency":
      return ["agency", "client reporting", "marketing analytics"];
    default:
      return [];
  }
}

function collectContextStrings(input: PlanWebResearchInput): string[] {
  const values = [
    input.project?.description,
    input.project?.name,
    input.profile?.businessName,
    ...(input.memories ?? []).map((memory) => memory.content),
    ...getBusinessTypeHints(input.profile?.businessType),
  ];

  return values
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => normalizeWhitespace(value));
}

function collectKeywords(input: PlanWebResearchInput, specificTopic: string): string[] {
  const combinedContext = [specificTopic, ...collectContextStrings(input)]
    .join(" ")
    .trim();

  if (!combinedContext) {
    return [];
  }

  const matches = KEYWORD_RULES.flatMap((rule) =>
    rule.pattern.test(combinedContext) ? [rule.canonical] : []
  );

  return unique(matches);
}

function buildFocusDescriptor(
  input: PlanWebResearchInput,
  specificTopic: string,
  keywords: string[]
): string {
  if (specificTopic) {
    return specificTopic;
  }

  const orderedKeywords = [
    "shopify",
    "ecommerce",
    "ai",
    "analytics",
    "business intelligence",
    "business analysis",
    "saas",
    "customer",
    "revenue",
    "store",
  ];
  const descriptorTerms = orderedKeywords.filter((keyword) =>
    keywords.includes(keyword)
  );

  if (descriptorTerms.length > 0) {
    return descriptorTerms.slice(0, 4).join(" ");
  }

  const contextPhrase = collectContextStrings(input).find(
    (value) => tokenize(value).filter((token) => !GENERIC_STOPWORDS.has(token)).length >= 2
  );

  return contextPhrase ? normalizeWhitespace(stripResearchBoilerplate(contextPhrase)) : "";
}

function buildBroadMarketQuery(
  keywords: string[],
  businessType: WebResearchBusinessType
): string {
  if (keywords.includes("shopify") && keywords.includes("analytics")) {
    return "shopify analytics tools alternatives";
  }

  if (keywords.includes("ecommerce") && keywords.includes("analytics")) {
    return "ecommerce analytics platforms competitors";
  }

  if (keywords.includes("ai") && keywords.includes("analytics")) {
    return "ai analytics platforms competitors";
  }

  if (
    keywords.includes("business intelligence") &&
    (keywords.includes("shopify") || keywords.includes("ecommerce"))
  ) {
    return "ecommerce business intelligence tools";
  }

  switch (businessType) {
    case "shopify":
      return "shopify ecommerce tools competitors";
    case "content_creator":
      return "creator analytics tools competitors";
    case "agency":
      return "marketing analytics tools for agencies";
    default:
      return "business analytics platforms competitors";
  }
}

function sanitizeQuery(query: string): string {
  const dedupedWords: string[] = [];

  for (const word of tokenize(query)) {
    if (!dedupedWords.includes(word)) {
      dedupedWords.push(word);
    }
  }

  return normalizeWhitespace(dedupedWords.join(" "));
}

export function detectWebResearchIntent(text: string): boolean {
  const normalized = normalizeForMatching(text);

  if (!normalized) {
    return false;
  }

  const competitorRequest = isCompetitorRequest(normalized);
  const marketResearchRequest = isMarketResearchRequest(normalized);
  const webReference = hasWebReference(normalized);
  const researchAction = hasResearchAction(normalized);
  const timeSensitiveSignal = hasTimeSensitiveSignal(normalized);

  return (
    competitorRequest ||
    (webReference && researchAction) ||
    (marketResearchRequest && (researchAction || timeSensitiveSignal)) ||
    (timeSensitiveSignal && webReference)
  );
}

export function planWebResearch(
  input: PlanWebResearchInput
): WebResearchPlan {
  const normalizedPrompt = normalizeWhitespace(input.userText);
  const normalizedForMatching = normalizeForMatching(normalizedPrompt);
  const intentMatched = detectWebResearchIntent(normalizedPrompt);

  if (!intentMatched) {
    return {
      intentMatched: false,
      mode: "none",
      candidateQueries: [],
      clarificationQuestion: null,
      normalizedPrompt,
      topicSummary: null,
      strategy: "general",
    };
  }

  const strategy: WebResearchPlan["strategy"] = isCompetitorRequest(
    normalizedForMatching
  )
    ? "competitor"
    : isMarketResearchRequest(normalizedForMatching)
      ? "market"
      : "general";

  const specificTopic = extractSpecificTopic(normalizedPrompt);
  const keywords = collectKeywords(input, specificTopic);
  const focusDescriptor = buildFocusDescriptor(input, specificTopic, keywords);
  const hasContext = collectContextStrings(input).length > 0;

  if (!specificTopic && !hasContext) {
    return {
      intentMatched: true,
      mode: "clarify",
      candidateQueries: [],
      clarificationQuestion:
        strategy === "competitor"
          ? "What kind of competitors should I search for?"
          : "What specific topic should I search for on the web?",
      normalizedPrompt,
      topicSummary: null,
      strategy,
    };
  }

  const candidateQueries = unique(
    [
      strategy === "competitor" && specificTopic
        ? `${specificTopic} competitors`
        : null,
      strategy === "competitor" && focusDescriptor
        ? `${focusDescriptor} platform competitors`
        : null,
      strategy === "competitor" && focusDescriptor
        ? `${focusDescriptor} tools alternatives`
        : null,
      strategy === "market" && specificTopic
        ? `${specificTopic} market trends`
        : null,
      strategy === "market" && focusDescriptor
        ? `${focusDescriptor} industry trends`
        : null,
      buildBroadMarketQuery(keywords, input.profile?.businessType),
      specificTopic || null,
    ]
      .filter((query): query is string => Boolean(query))
      .map((query) => sanitizeQuery(query))
      .filter((query) => query.length > 0)
  ).slice(0, 3);

  if (candidateQueries.length === 0) {
    return {
      intentMatched: true,
      mode: "clarify",
      candidateQueries: [],
      clarificationQuestion: "What specific topic should I search for on the web?",
      normalizedPrompt,
      topicSummary: null,
      strategy,
    };
  }

  return {
    intentMatched: true,
    mode: "search",
    candidateQueries,
    clarificationQuestion: null,
    normalizedPrompt,
    topicSummary: focusDescriptor || null,
    strategy,
  };
}
