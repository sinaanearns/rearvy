/**
 * Firecrawl API Client — v2
 * High-performance web scraping, crawling, search, map/link discovery,
 * structured data extraction, and cloud-hosted interactive browser sessions
 * powered by Firecrawl (https://github.com/firecrawl/firecrawl).
 *
 * API Docs: https://docs.firecrawl.dev/api-reference/v2-introduction
 */

// ---------------------------------------------------------------------------
// Action types for scrape-time page interactions
// ---------------------------------------------------------------------------
export type FirecrawlAction =
  | { type: "wait"; milliseconds?: number }
  | { type: "click"; selector: string }
  | { type: "write"; text: string; selector?: string }
  | { type: "press"; key: string }
  | { type: "scroll"; direction?: "up" | "down"; amount?: number }
  | { type: "scrape" }
  | { type: "screenshot" };

// ---------------------------------------------------------------------------
// Scrape
// ---------------------------------------------------------------------------
export type FirecrawlScrapeOptions = {
  formats?: Array<"markdown" | "html" | "rawHtml" | "screenshot" | "links">;
  actions?: FirecrawlAction[];
  onlyMainContent?: boolean;
  waitFor?: number;
  timeout?: number;
  mobile?: boolean;
  skipTlsVerification?: boolean;
};

export type FirecrawlPageMetadata = {
  title?: string;
  description?: string;
  language?: string;
  sourceURL?: string;
  /** The scrape job ID — use with /v2/scrape/{id}/interact for AI prompting */
  scrapeId?: string;
  statusCode?: number;
  error?: string | null;
};

export type FirecrawlScrapeData = {
  markdown?: string;
  html?: string;
  rawHtml?: string;
  screenshot?: string;
  links?: string[];
  metadata?: FirecrawlPageMetadata;
  actions?: { screenshots?: string[] };
};

export type FirecrawlScrapeResponse = {
  success: boolean;
  data?: FirecrawlScrapeData;
  /** Top-level scrape job ID for use with /v2/scrape/{id}/interact */
  id?: string;
  error?: string;
};

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
export type FirecrawlSearchScrapeOptions = {
  formats?: Array<"markdown" | "html" | "screenshot" | "links">;
  onlyMainContent?: boolean;
  timeout?: number;
};

export type FirecrawlSearchResultItem = {
  url: string;
  title: string;
  description?: string;
  markdown?: string;
  html?: string;
  screenshot?: string;
  category?: string;
  position?: number;
};

export type FirecrawlSearchResponse = {
  success: boolean;
  data?: {
    web?: FirecrawlSearchResultItem[];
    news?: FirecrawlSearchResultItem[];
    images?: FirecrawlSearchResultItem[];
  } | FirecrawlSearchResultItem[];
  warning?: string;
  error?: string;
};


// ---------------------------------------------------------------------------
// Crawl
// ---------------------------------------------------------------------------
export type FirecrawlCrawlOptions = {
  limit?: number;
  maxDepth?: number;
  scrapeOptions?: FirecrawlScrapeOptions;
};

export type FirecrawlCrawlJobResponse = {
  success: boolean;
  id?: string;
  url?: string;
  error?: string;
};

export type FirecrawlCrawlStatusResponse = {
  status: "scraping" | "completed" | "failed";
  total?: number;
  completed?: number;
  creditsUsed?: number;
  expiresAt?: string;
  data?: FirecrawlScrapeData[];
  error?: string;
};

// ---------------------------------------------------------------------------
// Map
// ---------------------------------------------------------------------------
export type FirecrawlMapResponse = {
  success: boolean;
  links?: string[];
  error?: string;
};

// ---------------------------------------------------------------------------
// Extract
// ---------------------------------------------------------------------------
export type FirecrawlExtractResponse<T = Record<string, unknown>> = {
  success: boolean;
  data?: T;
  error?: string;
};

// ---------------------------------------------------------------------------
// Interact — Standalone Cloud Browser Sessions (POST /v2/interact)
// ---------------------------------------------------------------------------
export type FirecrawlInteractSession = {
  success: boolean;
  id: string;
  cdpUrl?: string;
  liveViewUrl?: string;
  interactiveLiveViewUrl?: string;
  expiresAt?: string;
  error?: string;
};

export type FirecrawlInteractExecuteResponse = {
  success: boolean;
  stdout?: string;
  result?: string;
  stderr?: string;
  exitCode?: number;
  killed?: boolean;
  error?: string;
};

/** Response from POST /v2/scrape/{jobId}/interact with a natural-language prompt */
export type FirecrawlInteractPromptResponse = {
  success: boolean;
  cdpUrl?: string;
  liveViewUrl?: string;
  interactiveLiveViewUrl?: string;
  output?: string;
  stdout?: string;
  result?: string;
  stderr?: string;
  exitCode?: number;
  killed?: boolean;
  error?: string;
};

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
export function getFirecrawlBaseUrl(): string {
  const customUrl = process.env.FIRECRAWL_API_URL?.trim();
  if (customUrl) {
    return customUrl.replace(/\/+$/, "");
  }
  return "https://api.firecrawl.dev";
}

export function getFirecrawlApiKey(): string | null {
  return process.env.FIRECRAWL_API_KEY?.trim() || null;
}

export function isFirecrawlConfigured(): boolean {
  return Boolean(getFirecrawlApiKey() || process.env.FIRECRAWL_API_URL);
}

// ---------------------------------------------------------------------------
// Internal HTTP helper
// ---------------------------------------------------------------------------
async function firecrawlFetch<T>(
  endpoint: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    timeoutMs?: number;
  } = {}
): Promise<T> {
  const baseUrl = getFirecrawlBaseUrl();
  const apiKey = getFirecrawlApiKey();
  const url = `${baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 60_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const rawJson = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        rawJson?.error ||
        rawJson?.message ||
        `Firecrawl API error ${response.status}: ${response.statusText}`;
      throw new Error(message);
    }

    return rawJson as T;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Scrape
// ---------------------------------------------------------------------------
/**
 * Scrape a single URL with Firecrawl v2.
 * Returns markdown, screenshot, and metadata. Set formats to include "links"
 * to discover outbound links, or "html" for raw HTML.
 */
export async function firecrawlScrapeUrl(
  url: string,
  options: FirecrawlScrapeOptions = {}
): Promise<FirecrawlScrapeResponse> {
  const formats = options.formats || ["markdown", "screenshot"];
  const body: Record<string, unknown> = { url, formats };

  if (options.actions?.length) body.actions = options.actions;
  if (options.onlyMainContent !== undefined) body.onlyMainContent = options.onlyMainContent;
  if (options.waitFor !== undefined) body.waitFor = options.waitFor;
  if (options.timeout !== undefined) body.timeout = options.timeout;
  if (options.mobile) body.mobile = options.mobile;
  if (options.skipTlsVerification !== undefined) body.skipTlsVerification = options.skipTlsVerification;

  try {
    return await firecrawlFetch<FirecrawlScrapeResponse>("/v2/scrape", {
      method: "POST",
      body,
      timeoutMs: (options.timeout ?? 30) * 1000 + 15_000,
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
/**
 * Perform a web search with Firecrawl v2.
 * Supports operators: site:, filetype:, inurl:, intitle:, related:, "-", "".
 * Pass scrapeOptions to also return full scraped markdown per result.
 */
export async function firecrawlSearch(
  query: string,
  options: {
    limit?: number;
    scrapeOptions?: FirecrawlSearchScrapeOptions;
    country?: string;
    location?: string;
    tbs?: string;
    includeDomains?: string[];
    excludeDomains?: string[];
    categories?: Array<"github" | "research" | "pdf">;
  } = {}
): Promise<FirecrawlSearchResponse> {
  const body: Record<string, unknown> = {
    query,
    limit: options.limit ?? 10,
  };

  if (options.scrapeOptions) body.scrapeOptions = options.scrapeOptions;
  if (options.country) body.country = options.country;
  if (options.location) body.location = options.location;
  if (options.tbs) body.tbs = options.tbs;
  if (options.includeDomains?.length) body.includeDomains = options.includeDomains;
  if (options.excludeDomains?.length) body.excludeDomains = options.excludeDomains;
  if (options.categories?.length) body.categories = options.categories;

  try {
    return await firecrawlFetch<FirecrawlSearchResponse>("/v2/search", {
      method: "POST",
      body,
      timeoutMs: 45_000,
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ---------------------------------------------------------------------------
// Crawl
// ---------------------------------------------------------------------------
/**
 * Start an async multi-page crawl job with Firecrawl v2.
 */
export async function firecrawlStartCrawl(
  url: string,
  options: FirecrawlCrawlOptions = {}
): Promise<FirecrawlCrawlJobResponse> {
  try {
    return await firecrawlFetch<FirecrawlCrawlJobResponse>("/v2/crawl", {
      method: "POST",
      body: {
        url,
        limit: options.limit || 10,
        maxDepth: options.maxDepth || 2,
        ...(options.scrapeOptions ? { scrapeOptions: options.scrapeOptions } : {}),
      },
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check the status of a Firecrawl crawl job.
 */
export async function firecrawlGetCrawlStatus(
  jobId: string
): Promise<FirecrawlCrawlStatusResponse> {
  try {
    return await firecrawlFetch<FirecrawlCrawlStatusResponse>(`/v2/crawl/${jobId}`);
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ---------------------------------------------------------------------------
// Map
// ---------------------------------------------------------------------------
/**
 * Discover links/sitemaps on a target domain with Firecrawl v2 map endpoint.
 */
export async function firecrawlMapUrl(
  url: string,
  search?: string
): Promise<FirecrawlMapResponse> {
  try {
    return await firecrawlFetch<FirecrawlMapResponse>("/v2/map", {
      method: "POST",
      body: { url, ...(search ? { search } : {}) },
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ---------------------------------------------------------------------------
// Extract
// ---------------------------------------------------------------------------
/**
 * Extract structured JSON content from URLs using Firecrawl v2 extract.
 */
export async function firecrawlExtractData<T = Record<string, unknown>>(
  urls: string[],
  prompt: string,
  schema?: Record<string, unknown>
): Promise<FirecrawlExtractResponse<T>> {
  try {
    return await firecrawlFetch<FirecrawlExtractResponse<T>>("/v2/extract", {
      method: "POST",
      body: { urls, prompt, ...(schema ? { schema } : {}) },
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ---------------------------------------------------------------------------
// Interact — Standalone Cloud Browser Sessions
// ---------------------------------------------------------------------------
/**
 * Create a new standalone cloud-hosted Firecrawl Interact browser session.
 * Returns liveViewUrl (read-only) and interactiveLiveViewUrl (user can control).
 * Profile support enables persistent cookies/localStorage across sessions.
 */
export async function firecrawlCreateInteractSession(options: {
  ttl?: number;
  activityTtl?: number;
  profileName?: string;
  saveChanges?: boolean;
} = {}): Promise<FirecrawlInteractSession> {
  const body: Record<string, unknown> = {
    ttl: options.ttl ?? 600,
    streamWebView: true,
  };

  if (options.activityTtl !== undefined) body.activityTtl = options.activityTtl;
  if (options.profileName) {
    body.profile = {
      name: options.profileName,
      saveChanges: options.saveChanges ?? true,
    };
  }

  try {
    return await firecrawlFetch<FirecrawlInteractSession>("/v2/interact", {
      method: "POST",
      body,
      timeoutMs: 30_000,
    });
  } catch (error) {
    return {
      success: false,
      id: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Execute Playwright (Python/Node/Bash) code in a standalone Interact session.
 * Use `await page.goto("url")` for navigation, `await page.click("selector")` etc.
 */
export async function firecrawlExecuteInSession(
  sessionId: string,
  code: string,
  options: {
    language?: "python" | "node" | "bash";
    timeout?: number;
  } = {}
): Promise<FirecrawlInteractExecuteResponse> {
  const rawId = sessionId.replace(/^fc_/, "");
  try {
    return await firecrawlFetch<FirecrawlInteractExecuteResponse>(
      `/v2/interact/${rawId}/execute`,
      {
        method: "POST",
        body: {
          code,
          language: options.language ?? "python",
          ...(options.timeout !== undefined ? { timeout: options.timeout } : {}),
        },
        timeoutMs: (options.timeout ?? 60) * 1000 + 15_000,
      }
    );
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Send a natural-language prompt to an AI agent in a scrape-bound browser session.
 * The first call creates the browser session from the scrape state; subsequent calls reuse it.
 * Use for: "click the sign up button", "fill in the form with ...", "find the pricing table".
 */
export async function firecrawlInteractOnScrape(
  scrapeJobId: string,
  prompt: string,
  options: { timeout?: number } = {}
): Promise<FirecrawlInteractPromptResponse> {
  try {
    return await firecrawlFetch<FirecrawlInteractPromptResponse>(
      `/v2/scrape/${scrapeJobId}/interact`,
      {
        method: "POST",
        body: {
          prompt,
          ...(options.timeout !== undefined ? { timeout: options.timeout } : {}),
        },
        timeoutMs: (options.timeout ?? 60) * 1000 + 15_000,
      }
    );
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Stop and destroy a standalone Firecrawl Interact browser session.
 */
export async function firecrawlDeleteInteractSession(
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  const rawId = sessionId.replace(/^fc_/, "");
  try {
    return await firecrawlFetch<{ success: boolean }>(`/v2/interact/${rawId}`, {
      method: "DELETE",
      timeoutMs: 15_000,
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Stop the interactive browser session associated with a scrape job.
 */
export async function firecrawlStopScrapeSession(
  scrapeJobId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    return await firecrawlFetch<{ success: boolean }>(
      `/v2/scrape/${scrapeJobId}/interact`,
      { method: "DELETE", timeoutMs: 15_000 }
    );
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
