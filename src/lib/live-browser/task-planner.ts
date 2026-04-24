import type { BrowserCommandInput } from "./shared";

type BrowserTaskPlan = {
  startUrl: string | null;
  commands: BrowserCommandInput[];
  summary: string;
};

const DUCKDUCKGO_SEARCH_URL = "https://duckduckgo.com/?q=";

/**
 * Well-known site names → canonical URLs.
 * Covers common "open X" / "go to X" / "visit X" intents.
 */
const KNOWN_SITES: Record<string, string> = {
  pinterest: "https://www.pinterest.com",
  youtube: "https://www.youtube.com",
  reddit: "https://www.reddit.com",
  twitter: "https://twitter.com",
  x: "https://x.com",
  instagram: "https://www.instagram.com",
  facebook: "https://www.facebook.com",
  linkedin: "https://www.linkedin.com",
  tiktok: "https://www.tiktok.com",
  amazon: "https://www.amazon.com",
  netflix: "https://www.netflix.com",
  spotify: "https://open.spotify.com",
  github: "https://github.com",
  gmail: "https://mail.google.com",
  google: "https://www.google.com",
  bing: "https://www.bing.com",
  wikipedia: "https://www.wikipedia.org",
  notion: "https://www.notion.so",
  slack: "https://slack.com",
  discord: "https://discord.com",
  twitch: "https://www.twitch.tv",
  snapchat: "https://www.snapchat.com",
  whatsapp: "https://web.whatsapp.com",
  dropbox: "https://www.dropbox.com",
  medium: "https://medium.com",
  quora: "https://www.quora.com",
  stackoverflow: "https://stackoverflow.com",
  "stack overflow": "https://stackoverflow.com",
  ebay: "https://www.ebay.com",
  etsy: "https://www.etsy.com",
  shopify: "https://www.shopify.com",
};

/**
 * Patterns that indicate a navigation intent.
 * Group 1 captures the destination (site name, domain, or URL).
 */
const NAVIGATE_PATTERNS: RegExp[] = [
  /^(?:open|go\s+to|visit|navigate\s+to|browse\s+to|load|launch|show(?:\s+me)?)\s+["']?(.+?)["']?(?:\s+(?:website|site|page|app))?$/i,
  /^(?:take\s+me\s+to|bring\s+me\s+to)\s+["']?(.+?)["']?$/i,
];

function extractGoogleSearchQuery(task: string) {
  const patterns = [
    /\bsearch(?:\s+google)?\s+for\s+["']?(.+?)["']?(?:$|[.?!])/i,
    /\bsearch\s+["']?(.+?)["']?\s+on\s+google(?:$|[.?!])/i,
    /\bgoogle\s+["']?(.+?)["']?$/i,
  ];

  for (const pattern of patterns) {
    const match = task.match(pattern);
    const query = match?.[1]?.trim();
    if (query) {
      return query;
    }
  }

  return null;
}

/**
 * Tries to resolve the destination string into a fully qualified URL.
 * Returns null if it cannot confidently determine a URL.
 */
function resolveDestination(destination: string): string | null {
  const trimmed = destination.trim().toLowerCase();

  // 1. Already a valid absolute URL
  try {
    const parsed = new URL(destination.trim());
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return destination.trim();
    }
  } catch {
    // Not a URL — continue
  }

  // 2. Known site name (exact or with common suffixes stripped)
  const siteKey = trimmed.replace(/\.(com|org|net|io|co)$/, "");
  const knownUrl = KNOWN_SITES[trimmed] ?? KNOWN_SITES[siteKey];
  if (knownUrl) {
    return knownUrl;
  }

  // 3. Bare domain pattern like "reddit.com", "news.ycombinator.com"
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return null;
}

/**
 * Checks whether the task looks like a navigation intent (not a search query
 * or a general instruction), and if so returns the resolved URL.
 */
function extractNavigateUrl(task: string): string | null {
  for (const pattern of NAVIGATE_PATTERNS) {
    const match = task.trim().match(pattern);
    const destination = match?.[1]?.trim();
    if (!destination) {
      continue;
    }

    const url = resolveDestination(destination);
    if (url) {
      return url;
    }
  }

  return null;
}

export function planBrowserSessionFromTask(params: {
  task: string;
  startUrl?: string | null;
}) {
  const trimmedTask = params.task.trim();

  // 1. Explicit search intent
  const googleQuery = extractGoogleSearchQuery(trimmedTask);
  if (googleQuery) {
    const fallbackSearchUrl = `${DUCKDUCKGO_SEARCH_URL}${encodeURIComponent(
      googleQuery
    )}`;

    return {
      startUrl: fallbackSearchUrl,
      commands: [{ action: "goto", target: fallbackSearchUrl }],
      summary: `Live browser session searched for "${googleQuery}" using DuckDuckGo.`,
    } satisfies BrowserTaskPlan;
  }

  // 2. Explicit startUrl passed by caller (e.g. from an AI tool call)
  if (params.startUrl) {
    return {
      startUrl: params.startUrl,
      commands: [{ action: "goto", target: params.startUrl }],
      summary: `Live browser session opened ${params.startUrl}.`,
    } satisfies BrowserTaskPlan;
  }

  // 3. Natural language navigation intent like "open pinterest", "go to reddit"
  const navigateUrl = extractNavigateUrl(trimmedTask);
  if (navigateUrl) {
    return {
      startUrl: navigateUrl,
      commands: [{ action: "goto", target: navigateUrl }],
      summary: `Live browser session opened ${navigateUrl}.`,
    } satisfies BrowserTaskPlan;
  }

  // 4. Fallback – session starts at about:blank
  return {
    startUrl: null,
    commands: [],
    summary:
      "Live browser session started. Use structured browser commands to continue.",
  } satisfies BrowserTaskPlan;
}
