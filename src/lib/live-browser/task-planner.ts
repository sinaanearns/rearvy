import type { BrowserCommandInput } from "./shared";

type BrowserTaskPlan = {
  startUrl: string | null;
  commands: BrowserCommandInput[];
  summary: string;
};

const DUCKDUCKGO_SEARCH_URL = "https://duckduckgo.com/?q=";

function extractGoogleSearchQuery(task: string) {
  const patterns = [
    /\bsearch(?:\s+google)?\s+for\s+["']?(.+?)["']?(?:$|[.?!])/i,
    /\bsearch\s+["']?(.+?)["']?\s+on\s+google(?:$|[.?!])/i,
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

export function planBrowserSessionFromTask(params: {
  task: string;
  startUrl?: string | null;
}) {
  const trimmedTask = params.task.trim();
  const googleQuery = extractGoogleSearchQuery(trimmedTask);

  if (googleQuery) {
    const fallbackSearchUrl = `${DUCKDUCKGO_SEARCH_URL}${encodeURIComponent(
      googleQuery
    )}`;

    return {
      startUrl: fallbackSearchUrl,
      commands: [{ action: "goto", target: fallbackSearchUrl }],
      summary: `Live browser session searched for "${googleQuery}" using DuckDuckGo fallback to avoid Google automation blocks.`,
    } satisfies BrowserTaskPlan;
  }

  if (params.startUrl) {
    return {
      startUrl: params.startUrl,
      commands: [{ action: "goto", target: params.startUrl }],
      summary: `Live browser session opened ${params.startUrl}.`,
    } satisfies BrowserTaskPlan;
  }

  return {
    startUrl: null,
    commands: [],
    summary:
      "Live browser session started. Use structured browser commands to continue.",
  } satisfies BrowserTaskPlan;
}
