import type { BrowserCommandInput } from "./shared";

type BrowserTaskPlan = {
  startUrl: string | null;
  commands: BrowserCommandInput[];
  summary: string;
};

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
    return {
      startUrl: "https://www.google.com",
      commands: [
        { action: "goto", target: "https://www.google.com" },
        { action: "type", target: "textarea[name='q']", value: googleQuery },
        { action: "click", target: "Google Search" },
      ],
      summary: `Live browser session searched Google for "${googleQuery}".`,
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
