import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("WebTools");

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (compatible; RearvyBot/1.0; +https://rearvy.com)";
const MAX_SEARCH_RESULTS = 20;
const MAX_PAGE_CHARS = 12000;
const SEARCH_TYPES = [
  "general",
  "news",
  "images",
  "apis",
  "tools",
  "datasets",
  "academic",
] as const;

type SearchType = (typeof SEARCH_TYPES)[number];

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  source: string;
  rank: number;
};

export type PublicWebSearchResult = SearchResult;

type SearchResultMatch = {
  href: string;
  title: string;
  snippet: string;
};

export function buildSpecializedWebSearchQuery(query: string, searchType: SearchType = "general") {
  const trimmed = query.trim();

  if (!trimmed || searchType === "general") {
    return trimmed;
  }

  const suffixByType: Record<Exclude<SearchType, "general">, string> = {
    news: "latest news",
    images: "images visual examples",
    apis: "API documentation developer reference",
    tools: "software tools alternatives",
    datasets: "public dataset data source",
    academic: "research paper study",
  };

  const suffix = suffixByType[searchType];
  return /\b(site:|filetype:|latest news|api documentation|public dataset|research paper)\b/i.test(trimmed)
    ? trimmed
    : `${trimmed} ${suffix}`;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, num: string) =>
      String.fromCodePoint(parseInt(num, 10))
    )
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function optionalString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function decodeAndClean(value: string): string {
  return normalizeWhitespace(stripTags(decodeHtmlEntities(value)));
}

function extractDuckDuckGoTarget(rawHref: string): string {
  const href = decodeHtmlEntities(rawHref);
  const resolvedHref = href.startsWith("//") ? `https:${href}` : href;

  try {
    const parsed = new URL(resolvedHref);
    const target = parsed.searchParams.get("uddg");
    return target ? decodeURIComponent(target) : resolvedHref;
  } catch {
    return resolvedHref;
  }
}

function extractYahooTarget(rawHref: string): string {
  const href = decodeHtmlEntities(rawHref);

  try {
    const parsed = new URL(href);
    if (parsed.hostname === "r.search.yahoo.com") {
      const ruMatch = href.match(/\/RU=([^/]+)\//);
      if (ruMatch) {
        return decodeURIComponent(ruMatch[1]);
      }
    }
  } catch {
    return href;
  }

  return href;
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isPrivateIpv4(hostname: string): boolean {
  const ipv4Match = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!ipv4Match) return false;

  const first = Number(ipv4Match[1]);
  const second = Number(ipv4Match[2]);

  if (first === 10 || first === 127) return true;
  if (first === 169 && second === 254) return true;
  if (first === 192 && second === 168) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;

  return false;
}

function isPrivateHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();

  if (
    normalized === "localhost" ||
    normalized.endsWith(".local") ||
    normalized === "::1" ||
    normalized === "[::1]" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd")
  ) {
    return true;
  }

  return isPrivateIpv4(normalized);
}

function assertPublicHttpUrl(rawUrl: string): string {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL. Use a full http or https URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http and https URLs are supported.");
  }

  if (isPrivateHostname(parsed.hostname)) {
    throw new Error("Private or local network URLs are not allowed.");
  }

  return parsed.toString();
}

function isDuckDuckGoChallengePage(html: string): boolean {
  return /anomaly\.js/i.test(html) || /id="img-form"/i.test(html);
}

async function searchDuckDuckGo(
  query: string,
  limit: number
): Promise<SearchResult[]> {
  const parseMatches = (
    matches: SearchResultMatch[],
    startRank = 1
  ): SearchResult[] =>
    matches.slice(0, limit).map((match, index) => {
      const url = extractDuckDuckGoTarget(match.href);

      return {
        title: decodeAndClean(match.title),
        url,
        snippet: decodeAndClean(match.snippet),
        source: getHostname(url),
        rank: startRank + index,
      };
    });

  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": DEFAULT_USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error(`Search request failed with status ${response.status}.`);
  }

  const html = await response.text();
  if (isDuckDuckGoChallengePage(html)) {
    return [];
  }

  const titlePattern = /class="result__a" href="([^"]+)">([\s\S]*?)<\/a>/g;
  const titleMatches = [...html.matchAll(titlePattern)];
  const htmlMatches: SearchResultMatch[] = titleMatches.map((match, index) => {
    const segmentStart = match.index ?? 0;
    const segmentEnd = titleMatches[index + 1]?.index ?? html.length;
    const segment = html.slice(segmentStart, segmentEnd);

    const snippetMatch =
      segment.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/) ||
      segment.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/div>/);

    return {
      href: match[1],
      title: match[2],
      snippet: snippetMatch ? snippetMatch[1] : "",
    };
  });

  if (htmlMatches.length > 0) {
    return parseMatches(htmlMatches);
  }

  const liteUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
  const liteResponse = await fetch(liteUrl, {
    headers: {
      "User-Agent": DEFAULT_USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!liteResponse.ok) {
    return [];
  }

  const liteHtml = await liteResponse.text();
  if (isDuckDuckGoChallengePage(liteHtml)) {
    return [];
  }

  const litePattern =
    /<a rel="nofollow" href="([^"]+)" class='result-link'>([\s\S]*?)<\/a>[\s\S]*?<td class='result-snippet'>([\s\S]*?)<\/td>/g;
  const liteMatches = [...liteHtml.matchAll(litePattern)].map((match) => ({
    href: match[1],
    title: match[2],
    snippet: match[3],
  }));

  return parseMatches(liteMatches);
}

async function searchYahoo(
  query: string,
  limit: number
): Promise<SearchResult[]> {
  const url = `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": DEFAULT_USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error(`Search request failed with status ${response.status}.`);
  }

  const html = await response.text();
  const matches = [
    ...html.matchAll(
      /<div class="compTitle[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<div class="compText[^"]*"[^>]*>([\s\S]*?)<\/div>/g
    ),
  ];

  const results: SearchResult[] = [];

  for (const match of matches) {
    const targetUrl = extractYahooTarget(match[1]);
    const title = decodeAndClean(match[2]);
    const snippet = decodeAndClean(match[3]);
    const source = getHostname(targetUrl);

    if (
      !targetUrl ||
      !title ||
      title.toLowerCase() === "ads" ||
      source === "help.yahoo.com"
    ) {
      continue;
    }

    results.push({
      title,
      url: targetUrl,
      snippet,
      source,
      rank: results.length + 1,
    });

    if (results.length >= limit) {
      break;
    }
  }

  return results;
}

async function runGoogleSearch(
  query: string,
  limit: number
): Promise<SearchResult[]> {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_ENGINE_ID;

  if (!apiKey || !cx) {
    return [];
  }

  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&num=${limit}`;
  
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      log.warn("Google Search API failed", {
        status: response.status,
        statusText: response.statusText,
        queryLength: query.length,
        limit,
      });
      return [];
    }

    const data = (await response.json()) as unknown;
    const items = isRecord(data) && Array.isArray(data.items) ? data.items : [];

    return items.map((item, index) => ({
      title: isRecord(item) ? optionalString(item.title) : "",
      url: isRecord(item) ? optionalString(item.link) : "",
      snippet: isRecord(item) ? optionalString(item.snippet) : "",
      source: getHostname(isRecord(item) ? optionalString(item.link) : ""),
      rank: index + 1,
    }));
  } catch (error) {
    log.warn("Google Search request failed:", {
      queryLength: query.length,
      limit,
      error,
    });
    return [];
  }
}

async function runSearchFallbacks(
  query: string,
  limit: number
): Promise<SearchResult[]> {
  const simplifiedQuery = query
    .replace(/["'*]+/g, " ")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const candidateQueries = [
    query,
    ...(simplifiedQuery && simplifiedQuery !== query ? [simplifiedQuery] : []),
  ];

  for (const candidateQuery of candidateQueries) {
    const duckDuckGoResults = await searchDuckDuckGo(candidateQuery, limit);
    if (duckDuckGoResults.length > 0) {
      return duckDuckGoResults;
    }
  }

  for (const candidateQuery of candidateQueries) {
    const yahooResults = await searchYahoo(candidateQuery, limit);
    if (yahooResults.length > 0) {
      return yahooResults;
    }
  }

  return [];
}

export async function performWebSearch(
  query: string,
  limit = 10,
  searchType: SearchType = "general"
): Promise<{
  ok: boolean;
  message: string;
  query: string;
  effectiveQuery: string;
  searchType: SearchType;
  searchedAt: string;
  results: PublicWebSearchResult[];
  method?: string;
}> {
  try {
    const effectiveQuery = buildSpecializedWebSearchQuery(query, searchType);
    let results = await runGoogleSearch(effectiveQuery, limit);
    let method = "google";

    if (results.length === 0) {
      results = await runSearchFallbacks(effectiveQuery, limit);
      method = "fallbacks";
    }

    return {
      ok: true,
      method,
      message:
        results.length > 0
          ? `Found ${results.length} web results for "${effectiveQuery}".`
          : `No web results found for "${effectiveQuery}".`,
      query,
      effectiveQuery,
      searchType,
      searchedAt: new Date().toISOString(),
      results,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Web search failed unexpectedly.",
      query,
      effectiveQuery: buildSpecializedWebSearchQuery(query, searchType),
      searchType,
      searchedAt: new Date().toISOString(),
      results: [],
    };
  }
}

function extractReadableMarkdown(responseText: string): {
  title: string | null;
  content: string;
} {
  const titleMatch = responseText.match(/^Title:\s*(.+)$/m);
  const markdownIndex = responseText.indexOf("Markdown Content:");
  const rawContent =
    markdownIndex >= 0
      ? responseText.slice(markdownIndex + "Markdown Content:".length)
      : responseText;

  const content = rawContent
    .replace(/^Warning:.*$/gm, "")
    .replace(/^URL Source:.*$/gm, "")
    .replace(/^Published Time:.*$/gm, "")
    .trim();

  return {
    title: titleMatch ? normalizeWhitespace(titleMatch[1]) : null,
    content,
  };
}

async function fetchDirectPageText(url: string): Promise<{
  title: string | null;
  content: string;
}> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": DEFAULT_USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error(`Page request failed with status ${response.status}.`);
  }

  const html = await response.text();
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

  const content = decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<\/(p|div|section|article|h1|h2|h3|h4|h5|h6|li|br)>/gi, "\n")
      .replace(/<li/gi, "\n<li")
      .replace(/<[^>]+>/g, " ")
  );

  return {
    title: titleMatch ? decodeAndClean(titleMatch[1]) : null,
    content: normalizeWhitespace(content),
  };
}

async function fetchReadablePage(url: string): Promise<{
  title: string | null;
  content: string;
  method: "jina" | "direct";
}> {
  // The reader endpoint expects a full absolute URL after the host,
  // for example: https://r.jina.ai/https://example.com
  const jinaUrl = `https://r.jina.ai/${url}`;

  try {
    const response = await fetch(jinaUrl, {
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        Accept: "text/plain,text/markdown",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`Jina reader failed with status ${response.status}.`);
    }

    const text = await response.text();
    const parsed = extractReadableMarkdown(text);

    if (parsed.content) {
      return {
        ...parsed,
        method: "jina",
      };
    }
  } catch {
    // Fall back to direct fetch below.
  }

  const direct = await fetchDirectPageText(url);
  return {
    ...direct,
    method: "direct",
  };
}

export async function performWebPageFetch(
  url: string,
  maxChars = 6000
): Promise<{
  ok: boolean;
  message: string;
  title: string | null;
  url: string;
  source?: string;
  fetchedAt?: string;
  fetchMethod?: "jina" | "direct";
  truncated?: boolean;
  content: string;
  errorCode?: string;
}> {
  try {
    const publicUrl = assertPublicHttpUrl(url);
    const page = await fetchReadablePage(publicUrl);
    const content = page.content.slice(0, maxChars);

    return {
      ok: true,
      message: page.title ? `Opened ${page.title}.` : `Opened ${publicUrl}.`,
      title: page.title,
      url: publicUrl,
      source: getHostname(publicUrl),
      fetchedAt: new Date().toISOString(),
      fetchMethod: page.method,
      truncated: page.content.length > content.length,
      content,
    };
  } catch (error) {
    return {
      ok: false,
      errorCode: "WEB_PAGE_FETCH_FAILED",
      message:
        error instanceof Error
          ? error.message
          : "Failed to open the requested page.",
      url,
      content: "",
      title: null,
    };
  }
}

export function searchWeb(ctx: ToolContext) {
  void ctx;
  return tool({
    description:
      "Search the public web for current information, external research, competitor examples, articles, public sources, news, visual examples, API docs, tools, datasets, or academic references. Use searchType to bias the query for specialized retrieval.",
    inputSchema: z.object({
      query: z.string().min(2).describe("What to search for on the web"),
      searchType: z
        .enum(SEARCH_TYPES)
        .optional()
        .default("general")
        .describe("Optional search mode to bias the results toward news, images, API docs, tools, public datasets, or academic references."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(MAX_SEARCH_RESULTS)
        .optional()
        .default(10),
    }),
    execute: async ({ query, limit, searchType }) => {
      const result = await performWebSearch(query, limit, searchType);
      return result.ok
        ? result
        : {
            ...result,
            errorCode: "WEB_SEARCH_FAILED",
          };
    },
  });
}

export function fetchWebPage(ctx: ToolContext) {
  void ctx;
  return tool({
    description:
      "Open a public web page and return readable page content so you can cite or summarize it.",
    inputSchema: z.object({
      url: z.string().url().describe("The public http/https URL to open"),
      maxChars: z
        .number()
        .int()
        .min(500)
        .max(MAX_PAGE_CHARS)
        .optional()
        .default(6000),
    }),
    execute: async ({ url, maxChars }) => {
      return performWebPageFetch(url, maxChars);
    },
  });
}
