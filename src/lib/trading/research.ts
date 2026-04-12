import type { TradingAction, TradingResearchSource } from "@/types/trading";
import {
  performWebPageFetch,
  performWebSearch,
} from "@/lib/ai/tools/web";

type ResearchBias = "bullish" | "bearish" | "mixed" | "neutral";

export interface TradingResearchBundle {
  fetchedAt: number;
  summary: string;
  sources: TradingResearchSource[];
  bias: ResearchBias;
  bullishSources: number;
  bearishSources: number;
  sufficient: boolean;
  insufficiencyReason?: string;
}

type SourceWithContent = TradingResearchSource & {
  snippet?: string;
  content?: string;
  bias: ResearchBias;
};

const CREDIBLE_DOMAIN_PATTERNS = [
  /reuters\.com$/i,
  /finance\.yahoo\.com$/i,
  /bloomberg\.com$/i,
  /marketwatch\.com$/i,
  /investing\.com$/i,
  /investopedia\.com$/i,
  /cnbc\.com$/i,
  /apnews\.com$/i,
  /wsj\.com$/i,
  /ft\.com$/i,
  /coindesk\.com$/i,
  /theblock\.co$/i,
  /forexlive\.com$/i,
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
    return `${base} ${quote}`;
  }
  if (/^[A-Z]{1,5}$/.test(normalized)) {
    return `${normalized} stock`;
  }
  return normalized;
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

function buildResearchSummary(sources: SourceWithContent[]): string {
  return sources
    .slice(0, 3)
    .map((source) => {
      const detail = source.snippet || source.content || "Current market coverage reviewed.";
      return `${source.source}: ${source.title}. ${detail}`.trim();
    })
    .join(" ");
}

async function loadResearchSources(
  symbol: string
): Promise<SourceWithContent[]> {
  const query = `${normalizeSymbolForResearch(
    symbol
  )} latest market news analysis outlook`;
  const searchResult = await performWebSearch(query, 8);

  if (!searchResult.ok || searchResult.results.length === 0) {
    return [];
  }

  const picked = searchResult.results
    .filter((result) => {
      const domain = getDomain(result.url);
      if (!domain || isDisallowedDomain(domain)) return false;
      return isCredibleDomain(domain);
    })
    .filter(
      (result, index, list) =>
        list.findIndex(
          (candidate) => getDomain(candidate.url) === getDomain(result.url)
        ) === index
    )
    .slice(0, 3);

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
        snippet: result.snippet,
        content: page.ok ? page.content : undefined,
        bias: analyzeSourceBias(combinedText),
      } satisfies SourceWithContent;
    })
  );

  return loadedPages.filter((source) => Boolean(source.content || source.snippet));
}

export async function fetchTradingResearch(
  symbol: string
): Promise<TradingResearchBundle> {
  const sources = await loadResearchSources(symbol);
  const bullishSources = sources.filter((source) => source.bias === "bullish").length;
  const bearishSources = sources.filter((source) => source.bias === "bearish").length;
  const distinctDomains = new Set(sources.map((source) => getDomain(source.url)));

  let bias: ResearchBias = "neutral";
  if (bullishSources > 0 && bearishSources > 0) bias = "mixed";
  else if (bullishSources > bearishSources) bias = "bullish";
  else if (bearishSources > bullishSources) bias = "bearish";

  const sufficient =
    sources.length >= 2 &&
    distinctDomains.size >= 2 &&
    bias !== "neutral" &&
    bias !== "mixed";

  return {
    fetchedAt: Date.now(),
    summary: buildResearchSummary(sources),
    sources: sources.map(({ title, url, source }) => ({ title, url, source })),
    bias,
    bullishSources,
    bearishSources,
    sufficient,
    insufficiencyReason: sufficient
      ? undefined
      : sources.length < 2 || distinctDomains.size < 2
        ? "Need at least two recent public sources from different domains."
        : "Current public research is mixed or lacks a clear directional bias.",
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
