import type { TradingAction, TradingResearchSource } from "@/types/trading";
import {
  performWebPageFetch,
  performWebSearch,
} from "@/lib/ai/tools/web";
import { createServerLogger } from "@/lib/server-logger";

type ResearchBias = "bullish" | "bearish" | "mixed" | "neutral";

export interface TradingResearchBundle {
  fetchedAt: number;
  summary: string;
  sources: TradingResearchSource[];
  bias: ResearchBias;
  bullishSources: number;
  bearishSources: number;
  sentimentScore: number;
  consensus: number;
  sufficient: boolean;
  insufficiencyReason?: string;
}

type SourceWithContent = TradingResearchSource & {
  snippet?: string;
  content?: string;
  bias: ResearchBias;
};

const log = createServerLogger("TradingResearch");

function shouldLogTradingDiagnostics(): boolean {
  return process.env.REARVY_TRADING_DEBUG === "1";
}

const CREDIBLE_DOMAIN_PATTERNS = [
  /reuters\.com$/i,
  /finance\.yahoo\.com$/i,
  /yahoo\.com$/i,
  /bloomberg\.com$/i,
  /marketwatch\.com$/i,
  /investing\.com$/i,
  /investopedia\.com$/i,
  /cnbc\.com$/i,
  /nasdaq\.com$/i,
  /barrons\.com$/i,
  /seekingalpha\.com$/i,
  /fool\.com$/i,
  /apnews\.com$/i,
  /wsj\.com$/i,
  /ft\.com$/i,
  /coindesk\.com$/i,
  /cointelegraph\.com$/i,
  /decrypt\.co$/i,
  /beincrypto\.com$/i,
  /bitcoinmagazine\.com$/i,
  /newsbtc\.com$/i,
  /cryptopotato\.com$/i,
  /thedefiant\.io$/i,
  /theblock\.co$/i,
  /forexlive\.com$/i,
  /fxstreet\.com$/i,
  /dailyfx\.com$/i,
  /fxempire\.com$/i,
  /forexfactory\.com$/i,
  /tradingeconomics\.com$/i,
  /kitco\.com$/i,
];

const DISALLOWED_DOMAIN_PATTERNS = [
  /reddit\.com$/i,
  /youtube\.com$/i,
  /x\.com$/i,
  /twitter\.com$/i,
  /facebook\.com$/i,
  /instagram\.com$/i,
  /tradingview\.com$/i,
  /stocktwits\.com$/i,
];

const BULLISH_PATTERNS = [
  /\bbullish\b/i,
  /\bbreakout\b/i,
  /\brally\b/i,
  /\bsurge\b/i,
  /\bupside\b/i,
  /\bupgrade\b/i,
  /\binflow(s)?\b/i,
  /\bstrong demand\b/i,
  /\baccumulation\b/i,
  /\bbeats? expectations\b/i,
  /\bpositive outlook\b/i,
  /\bsupport holds?\b/i,
];

const BEARISH_PATTERNS = [
  /\bbearish\b/i,
  /\bbreakdown\b/i,
  /\bsell-?off\b/i,
  /\bdownside\b/i,
  /\bdowngrade\b/i,
  /\boutflow(s)?\b/i,
  /\bweak guidance\b/i,
  /\bmiss(es|ed)? expectations\b/i,
  /\bresistance holds?\b/i,
  /\bcrackdown\b/i,
  /\blawsuit\b/i,
  /\brisk-?off\b/i,
];

const NEUTRAL_PATTERNS = [
  /\bmixed\b/i,
  /\buncertain\b/i,
  /\bno clear\b/i,
  /\bwait-?and-?see\b/i,
  /\bsideways\b/i,
  /\brangebound\b/i,
  /\bvolatile\b/i,
];

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function isCredibleDomain(domain: string): boolean {
  return CREDIBLE_DOMAIN_PATTERNS.some((pattern) => pattern.test(domain));
}

function isDisallowedDomain(domain: string): boolean {
  return DISALLOWED_DOMAIN_PATTERNS.some((pattern) => pattern.test(domain));
}

function normalizeSymbolForResearch(symbol: string): string {
  const normalized = symbol.replace(/\s+/g, "").toUpperCase();

  if (normalized.startsWith("BTC")) return "Bitcoin BTC";
  if (normalized.startsWith("ETH")) return "Ethereum ETH";
  if (normalized.startsWith("SOL")) return "Solana SOL";
  if (normalized.startsWith("XRP")) return "XRP Ripple";
  if (normalized.startsWith("ADA")) return "Cardano ADA";
  if (normalized.startsWith("DOGE")) return "Dogecoin DOGE";
  if (normalized.startsWith("BNB")) return "BNB Binance Coin";
  if (normalized.startsWith("XAU")) return "Gold XAU";
  if (normalized.startsWith("XAG")) return "Silver XAG";
  if (normalized.includes("/")) {
    const [base, quote] = normalized.split("/");
    const pair = `${base}/${quote}`;

    if (
      ["EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "USD"].includes(base) ||
      ["EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "USD"].includes(quote)
    ) {
      return `${pair} forex ECB Fed macro`;
    }

    if (["XAU", "XAG"].includes(base) || ["XAU", "XAG"].includes(quote)) {
      return `${pair} metals macro yields dollar`;
    }

    return `${base} ${quote}`;
  }
  if (/^[A-Z]{1,5}$/.test(normalized)) {
    return `${normalized} stock`;
  }
  return normalized;
}

function getSymbolRelevanceTerms(symbol: string): string[] {
  const normalized = symbol.replace(/\s+/g, "").toUpperCase();
  const terms = new Set<string>();

  const add = (...values: string[]) => {
    for (const value of values) {
      if (value && value.trim().length >= 2) {
        terms.add(value.trim().toLowerCase());
      }
    }
  };

  if (normalized.includes("/")) {
    const [base, quote] = normalized.split("/");
    if (base && quote) {
      add(base, quote, `${base}/${quote}`, `${base}-${quote}`, `${base}${quote}`);
    }
  }

  if (normalized.startsWith("BTC")) add("btc", "bitcoin", "btcusd", "btc-usd", "btc/usd");
  if (normalized.startsWith("ETH")) add("eth", "ethereum", "ethusd", "eth-usd", "eth/usd");
  if (normalized.startsWith("SOL")) add("sol", "solana", "solusd", "sol-usd", "sol/usd");
  if (normalized.startsWith("XRP")) add("xrp", "ripple", "xrpusd", "xrp-usd", "xrp/usd");
  if (normalized.startsWith("ADA")) add("ada", "cardano", "adausd", "ada-usd", "ada/usd");
  if (normalized.startsWith("DOGE")) add("doge", "dogecoin", "dogeusd", "doge-usd", "doge/usd");
  if (normalized.startsWith("BNB")) add("bnb", "binance coin", "bnbusd", "bnb-usd", "bnb/usd");
  if (normalized.startsWith("XAU")) add("xau", "gold", "xauusd", "xau-usd", "xau/usd");
  if (normalized.startsWith("XAG")) add("xag", "silver", "xagusd", "xag-usd", "xag/usd");

  if (/^[A-Z]{1,5}$/.test(normalized)) {
    add(normalized.toLowerCase());
  }

  return [...terms];
}

function sourceLooksRelevantToSymbol(source: SourceWithContent, symbol: string): boolean {
  const terms = getSymbolRelevanceTerms(symbol);
  if (terms.length === 0) return true;

  const haystack = normalizeForComparison(
    `${source.title || ""} ${source.snippet || ""} ${source.content || ""} ${source.url || ""}`
  );

  return terms.some((term) => haystack.includes(normalizeForComparison(term)));
}

function pickDistinctDomains(sources: SourceWithContent[], limit: number): SourceWithContent[] {
  const picked: SourceWithContent[] = [];
  const seen = new Set<string>();

  for (const source of sources) {
    if (picked.length >= limit) {
      break;
    }

    const domain = getDomain(source.url) || source.source;
    if (!domain || seen.has(domain)) {
      continue;
    }

    seen.add(domain);
    picked.push(source);
  }

  return picked;
}

function isUsefulResearchSource(source: SourceWithContent, symbol: string): boolean {
  if (!sourceLooksRelevantToSymbol(source, symbol)) {
    return false;
  }

  const title = cleanResearchText(source.title || "");
  const snippet = cleanResearchText(source.snippet || "");
  const content = cleanResearchText(source.content || "");
  const candidate = `${title} ${snippet || content}`.trim();

  if (!candidate || candidate.length < 70) {
    return false;
  }

  if (looksLikeNavigationNoise(candidate)) {
    return false;
  }

  const genericTitle = /^(markets?|news|latest news|finance|business)$/i.test(title);
  if (genericTitle && (snippet || content).length < 90) {
    return false;
  }

  return true;
}

function buildResearchQueries(symbol: string): string[] {
  const normalized = normalizeSymbolForResearch(symbol);
  const queries = [
    `${normalized} latest market news analysis outlook`,
    `${normalized} price forecast technical analysis`,
    `${normalized} catalysts regulation earnings outlook`,
    `${normalized} institutional flows macro news`,
    `${normalized} Reuters Yahoo Finance MarketWatch analysis`,
  ];

  if (/forex|metals|gold|silver|xau|xag|eur|gbp|jpy|chf|cad|aud|nzd|usd/i.test(normalized)) {
    queries.push(`${normalized} central bank inflation rates macro outlook`);
    queries.push(`${normalized} FXStreet DailyFX analysis news`);
  }

  if (/btc|eth|sol|xrp|ada|doge|bnb|crypto|bitcoin|ethereum/i.test(normalized)) {
    queries.push(`${normalized} on-chain exchange flows ETF adoption news`);
    queries.push(`${normalized} CoinDesk Cointelegraph analysis news`);
  }

  return [...new Set(queries)];
}

function analyzeSourceBias(text: string): ResearchBias {
  const bullishScore = BULLISH_PATTERNS.reduce(
    (count, pattern) => count + (pattern.test(text) ? 1 : 0),
    0
  );
  const bearishScore = BEARISH_PATTERNS.reduce(
    (count, pattern) => count + (pattern.test(text) ? 1 : 0),
    0
  );
  const neutralSignals = NEUTRAL_PATTERNS.some((pattern) => pattern.test(text));

  if (bullishScore > 0 && bearishScore > 0) return "mixed";
  if (bullishScore > bearishScore) return "bullish";
  if (bearishScore > bullishScore) return "bearish";
  if (neutralSignals) return "neutral";
  return "neutral";
}

function cleanResearchText(value: string): string {
  if (!value) return "";

  const withoutMarkdownLinks = value.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
  const withoutBullets = withoutMarkdownLinks.replace(/\s\*\s/g, " ");
  const normalized = withoutBullets.replace(/\s+/g, " ").trim();

  const noisePatterns = [
    /skip to navigation/gi,
    /skip to main content/gi,
    /skip to right column/gi,
    /oops, something went wrong/gi,
    /today'?s news/gi,
    /us politics/gi,
    /sponsored/gi,
    /sign in/gi,
    /log in/gi,
    /cookie(s)?/gi,
    /privacy( policy)?/gi,
    /terms( of service)?/gi,
  ];

  let cleaned = normalized;
  for (const pattern of noisePatterns) {
    cleaned = cleaned.replace(pattern, " ");
  }

  return cleaned.replace(/\s+/g, " ").trim();
}

function looksLikeNavigationNoise(value: string): boolean {
  const lowered = value.toLowerCase();
  const noiseHits = [
    "skip to",
    "search",
    "news",
    "video",
    "prices",
    "research",
    "sponsored",
    "today's",
    "markets",
  ].reduce((count, token) => count + (lowered.includes(token) ? 1 : 0), 0);

  const repeatedBrandTokens = [
    "yahoo finance",
    "coindesk",
    "marketwatch",
    "reuters",
    "bloomberg",
  ].reduce((count, token) => count + ((lowered.match(new RegExp(token, "g")) || []).length > 1 ? 1 : 0), 0);

  const symbolCount = (value.match(/[|#*\[\]()/]/g) || []).length;
  return noiseHits >= 3 || symbolCount >= 8 || repeatedBrandTokens >= 1;
}

function normalizeForComparison(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripLeadingSourceLabel(detail: string, source: string): string {
  const pattern = new RegExp(`^${source.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}:\\s*`, "i");
  return detail.replace(pattern, "").trim();
}

function getBestSourceDetail(source: SourceWithContent): string {
  const snippet = cleanResearchText(source.snippet || "");
  const content = cleanResearchText(source.content || "");
  const candidate = snippet || content;
  if (!candidate) {
    return "Recent market coverage reviewed.";
  }

  if (looksLikeNavigationNoise(candidate)) {
    return `Recent market coverage captured from ${source.source}.`;
  }

  const sentence = candidate
    .split(/(?<=[.!?])\s+/)
    .map((part) => cleanResearchText(part))
    .find((part) => part.length >= 40 && !looksLikeNavigationNoise(part));

  const picked = sentence || candidate;
  return stripLeadingSourceLabel(picked.slice(0, 220).trim(), source.source);
}

function buildFallbackCoverageUrls(symbol: string): string[] {
  const normalized = symbol.replace(/\s+/g, "").toUpperCase();
  const queryTicker = normalized.includes("/")
    ? normalized.replace("/", "-")
    : normalized;
  const baseAsset = normalized.includes("/") ? normalized.split("/")[0] : normalized;

  const urls = [
    "https://www.reuters.com/markets/",
    "https://finance.yahoo.com/markets/",
    "https://www.marketwatch.com/markets",
  ];

  if (normalized.startsWith("BTC") || normalized.startsWith("ETH") || normalized.startsWith("SOL") || normalized.startsWith("XRP")) {
    urls.push("https://www.coindesk.com/markets/");
    urls.push(`https://finance.yahoo.com/quote/${queryTicker}/`);

    const coindeskTagByAsset: Record<string, string> = {
      BTC: "bitcoin",
      ETH: "ethereum",
      SOL: "solana",
      XRP: "xrp",
      ADA: "cardano",
      BNB: "bnb",
    };
    const tag = coindeskTagByAsset[baseAsset];
    if (tag) {
      urls.push(`https://www.coindesk.com/tag/${tag}/`);
    }
  } else if (normalized.includes("/") && /(EUR|GBP|JPY|CHF|CAD|AUD|NZD|USD|XAU|XAG)/.test(normalized)) {
    urls.push("https://www.fxstreet.com/news");
    urls.push("https://www.dailyfx.com/latest-news");
  } else {
    urls.push(`https://finance.yahoo.com/quote/${queryTicker}/`);
    urls.push("https://www.investing.com/news/stock-market-news");
  }

  return [...new Set(urls)];
}

async function loadFallbackCoverageSources(
  symbol: string,
  existingDomains: Set<string>,
  maxCount: number
): Promise<SourceWithContent[]> {
  const candidates = buildFallbackCoverageUrls(symbol);
  const fallbackSources: SourceWithContent[] = [];

  for (const url of candidates) {
    if (fallbackSources.length >= maxCount) {
      break;
    }

    const domain = getDomain(url);
    if (!domain || isDisallowedDomain(domain) || existingDomains.has(domain)) {
      continue;
    }

    const page = await performWebPageFetch(url, 2200);
    if (!page.ok) {
      continue;
    }

    const title = page.title || domain;
    const content = page.content || "";
    const combinedText = `${title} ${content}`;

    fallbackSources.push({
      title,
      url,
      source: domain,
      snippet: cleanResearchText(content).slice(0, 240),
      content,
      bias: analyzeSourceBias(combinedText),
    });

    existingDomains.add(domain);
  }

  return fallbackSources;
}

function buildResearchSummary(sources: SourceWithContent[]): string {
  return sources
    .slice(0, 2)
    .map((source) => {
      const title = cleanResearchText(source.title || source.source || "Source");
      const detail = getBestSourceDetail(source);
      const normalizedTitle = normalizeForComparison(title);
      const normalizedDetail = normalizeForComparison(detail);
      if (
        !normalizedDetail ||
        normalizedDetail === normalizedTitle ||
        normalizedDetail.includes(normalizedTitle)
      ) {
        return `${source.source}: ${title}.`.trim();
      }

      return `${source.source}: ${title}. ${detail.slice(0, 140)}`.trim();
    })
    .join(" ");
}

async function loadResearchSources(
  symbol: string
): Promise<SourceWithContent[]> {
  const queryVariants = buildResearchQueries(symbol);
  const searchBatches = await Promise.all(
    queryVariants.map(async (query) => performWebSearch(query, 8))
  );
  const searchResults = searchBatches.flatMap((result) =>
    result.ok ? result.results : []
  );

  const eligible = searchResults
    .filter((result) => {
      const domain = getDomain(result.url);
      if (!domain || isDisallowedDomain(domain)) return false;
      return true;
    })
    .filter((result, index, list) =>
      list.findIndex(
        (candidate) => getDomain(candidate.url) === getDomain(result.url)
      ) === index
    );

  const preferred = eligible.filter((result) =>
    isCredibleDomain(getDomain(result.url))
  );

  // Prefer whitelisted financial outlets, but gracefully fall back to other
  // non-disallowed domains so research does not collapse to a single source.
  const picked = (preferred.length >= 4 ? preferred : eligible).slice(0, 12);

  const loadedPages = await Promise.all(
    picked.map(async (result) => {
      const page = await performWebPageFetch(result.url, 2200);
      const combinedText = `${result.title} ${result.snippet} ${
        page.ok ? page.content : ""
      }`;

      return {
        title: result.title,
        url: result.url,
        source: result.source || getDomain(result.url),
        snippet: cleanResearchText(result.snippet),
        content: page.ok ? page.content : undefined,
        bias: analyzeSourceBias(combinedText),
      } satisfies SourceWithContent;
    })
  );

  const normalizedLoaded = loadedPages.filter((source) => Boolean(source.content || source.snippet));
  const usefulLoaded = normalizedLoaded.filter((source) =>
    isUsefulResearchSource(source, symbol)
  );

  const selectedLoaded = pickDistinctDomains(usefulLoaded, 5);

  const existingDomains = new Set(selectedLoaded.map((source) => getDomain(source.url)).filter(Boolean));

  if (existingDomains.size >= 2 && selectedLoaded.length >= 2) {
    return selectedLoaded;
  }

  // If search engines are blocked or sparse, directly fetch a few reputable
  // market coverage pages to avoid returning zero research sources.
  const fallback = await loadFallbackCoverageSources(symbol, existingDomains, 3);
  const usefulFallback = pickDistinctDomains(
    fallback.filter((source) => isUsefulResearchSource(source, symbol)),
    3
  );

  const combined = pickDistinctDomains([...selectedLoaded, ...usefulFallback], 5);

  if (shouldLogTradingDiagnostics()) {
    log.debug("fallback-attempt", {
      symbol,
      queryCount: queryVariants.length,
      searchResultCount: searchResults.length,
      preFallbackSourceCount: selectedLoaded.length,
      usefulSourceCount: usefulLoaded.length,
      fallbackSourceCount: fallback.length,
      usefulFallbackSourceCount: usefulFallback.length,
      domains: [...new Set(combined.map((source) => getDomain(source.url)).filter(Boolean))],
    });
  }
  return combined;
}

export async function fetchTradingResearch(
  symbol: string
): Promise<TradingResearchBundle> {
  const sources = await loadResearchSources(symbol);

  if (sources.length === 0) {
    if (shouldLogTradingDiagnostics()) {
      log.warn("zero-sources", {
        symbol,
        message: "No credible public market sources found after search and fallback.",
      });
    }

    return {
      fetchedAt: Date.now(),
      summary: "",
      sources: [],
      bias: "neutral",
      bullishSources: 0,
      bearishSources: 0,
      sentimentScore: 0,
      consensus: 0,
      sufficient: false,
      insufficiencyReason:
        "No credible public market sources were found right now. Research signal is unavailable, so no directional conviction can be derived.",
    };
  }

  const bullishSources = sources.filter((source) => source.bias === "bullish").length;
  const bearishSources = sources.filter((source) => source.bias === "bearish").length;
  const directionalSources = bullishSources + bearishSources;
  const distinctDomains = new Set(sources.map((source) => getDomain(source.url)));

  let bias: ResearchBias = "neutral";
  if (bullishSources > 0 && bearishSources > 0) bias = "mixed";
  else if (bullishSources > bearishSources) bias = "bullish";
  else if (bearishSources > bullishSources) bias = "bearish";

  const sentimentScore =
    directionalSources > 0
      ? Number(((bullishSources - bearishSources) / directionalSources).toFixed(2))
      : 0;
  const consensus =
    directionalSources > 0
      ? Number((Math.max(bullishSources, bearishSources) / directionalSources).toFixed(2))
      : 0;

  const sufficient =
    sources.length >= 2 &&
    distinctDomains.size >= 2 &&
    bias !== "neutral" &&
    bias !== "mixed";

  const conciseInsufficientSummary = (() => {
    if (sufficient) {
      return undefined;
    }

    const domains = [...distinctDomains].filter(Boolean).slice(0, 3);
    const domainText = domains.length > 0 ? domains.join(", ") : "available public sources";
    return `Coverage checked across ${domainText}. No clear directional catalyst was found.`;
  })();

  const insufficiencyReason = (() => {
    if (sufficient) {
      return undefined;
    }

    if (sources.length === 0) {
      return "No credible public market sources were found right now.";
    }

    if (sources.length < 2 || distinctDomains.size < 2) {
      const domains = [...distinctDomains].filter(Boolean);
      const domainText = domains.length > 0 ? ` (${domains.join(", ")})` : "";
      return `Only ${sources.length} credible source(s) found across ${distinctDomains.size} domain(s)${domainText}. Need at least two recent sources from different domains.`;
    }

    return "Current public research is mixed or lacks a clear directional bias.";
  })();

  if (shouldLogTradingDiagnostics()) {
    log.debug("bundle", {
      symbol,
      sourceCount: sources.length,
      distinctDomainCount: distinctDomains.size,
      bullishSources,
      bearishSources,
      bias,
      sufficient,
      insufficiencyReason,
    });
  }

  return {
    fetchedAt: Date.now(),
    summary: conciseInsufficientSummary ?? buildResearchSummary(sources),
    sources: sources.map(({ title, url, source }) => ({ title, url, source })),
    bias,
    bullishSources,
    bearishSources,
    sentimentScore,
    consensus,
    sufficient,
    insufficiencyReason,
  };
}

export function researchSupportsAction(
  action: TradingAction,
  research: TradingResearchBundle | null | undefined
): boolean {
  if (!research?.sufficient) {
    return false;
  }

  if (action === "Buy") {
    return research.bias === "bullish";
  }

  if (action === "Sell") {
    return research.bias === "bearish";
  }

  return false;
}
