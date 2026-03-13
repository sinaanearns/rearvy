import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (compatible; RearvyBot/1.0; +https://rearvy.com)";
const MAX_SEARCH_RESULTS = 8;
const MAX_PAGE_CHARS = 12000;

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
  const litePattern =
    /<a rel="nofollow" href="([^"]+)" class='result-link'>([\s\S]*?)<\/a>[\s\S]*?<td class='result-snippet'>([\s\S]*?)<\/td>/g;
  const liteMatches = [...liteHtml.matchAll(litePattern)].map((match) => ({
    href: match[1],
    title: match[2],
    snippet: match[3],
  }));

  return parseMatches(liteMatches);
}

export async function performWebSearch(
  query: string,
  limit = 5
): Promise<{
  ok: boolean;
  message: string;
  query: string;
  searchedAt: string;
  results: PublicWebSearchResult[];
}> {
  try {
    let results = await searchDuckDuckGo(query, limit);

    if (results.length === 0) {
      const simplifiedQuery = query
        .replace(/["'*]+/g, " ")
        .replace(/[()]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (simplifiedQuery && simplifiedQuery !== query) {
        results = await searchDuckDuckGo(simplifiedQuery, limit);
      }
    }

    return {
      ok: true,
      message:
        results.length > 0
          ? `Found ${results.length} web results for "${query}".`
          : `No web results found for "${query}".`,
      query,
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
  const jinaUrl = `https://r.jina.ai/http://${url}`;

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
      "Search the public web for current information, external research, competitor examples, articles, and public sources.",
    inputSchema: z.object({
      query: z.string().min(2).describe("What to search for on the web"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(MAX_SEARCH_RESULTS)
        .optional()
        .default(5),
    }),
    execute: async ({ query, limit }) => {
      const result = await performWebSearch(query, limit);
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
