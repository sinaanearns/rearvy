import { spawn } from "node:child_process";
import path from "node:path";
import type { TradingAction, TradingOpinion, Timeframe } from "@/types/trading";
import type { MarketData } from "@/lib/trading/opinion-engine";
import type { TradingResearchBundle } from "@/lib/trading/research";

type TradingAgentsProvider =
  | "openai"
  | "google"
  | "anthropic"
  | "xai"
  | "deepseek"
  | "qwen"
  | "glm"
  | "openrouter"
  | "azure";

type TradingAgentsBridgeResult = {
  ok: boolean;
  decision?: string;
  finalDecision?: string;
  reports?: Partial<Record<"market" | "sentiment" | "news" | "fundamentals" | "trader", string>>;
  provider?: string;
  deepModel?: string;
  quickModel?: string;
  selectedAnalysts?: string[];
  error?: string;
  errorType?: string;
};

type TradingAgentsOpinionInput = {
  symbol: string;
  timeframe: Timeframe;
  marketData?: MarketData;
  research?: TradingResearchBundle | null;
  baselineOpinion?: TradingOpinion | null;
};

const PROVIDER_KEY_ENV: Record<TradingAgentsProvider, string[]> = {
  openai: ["OPENAI_API_KEY"],
  google: ["GOOGLE_API_KEY"],
  anthropic: ["ANTHROPIC_API_KEY"],
  xai: ["XAI_API_KEY"],
  deepseek: ["DEEPSEEK_API_KEY"],
  qwen: ["DASHSCOPE_API_KEY"],
  glm: ["ZHIPU_API_KEY"],
  openrouter: ["OPENROUTER_API_KEY"],
  azure: ["AZURE_OPENAI_API_KEY", "AZURE_OPENAI_ENDPOINT"],
};

const PROVIDER_ORDER: TradingAgentsProvider[] = [
  "openai",
  "google",
  "anthropic",
  "xai",
  "deepseek",
  "qwen",
  "glm",
  "openrouter",
  "azure",
];

function isDisabledByEnv() {
  const value = process.env.TRADINGAGENTS_ENABLED?.trim().toLowerCase();
  return value === "0" || value === "false" || value === "off";
}

function hasAllEnv(keys: string[]) {
  return keys.every((key) => Boolean(process.env[key]?.trim()));
}

function resolveProvider(): TradingAgentsProvider | null {
  const configured = process.env.TRADINGAGENTS_LLM_PROVIDER?.trim().toLowerCase();
  if (configured && configured in PROVIDER_KEY_ENV) {
    const provider = configured as TradingAgentsProvider;
    return hasAllEnv(PROVIDER_KEY_ENV[provider]) ? provider : null;
  }

  for (const provider of PROVIDER_ORDER) {
    if (hasAllEnv(PROVIDER_KEY_ENV[provider])) {
      return provider;
    }
  }

  return null;
}

function getTimeoutMs() {
  const raw = Number(process.env.TRADINGAGENTS_TIMEOUT_MS || 90000);
  if (!Number.isFinite(raw)) {
    return 90000;
  }

  return Math.min(5 * 60 * 1000, Math.max(5000, raw));
}

function compactText(value: string | undefined, maxLength = 1200) {
  const normalized = (value || "")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
}

function toTradingAgentsTicker(symbol: string) {
  const compact = symbol.replace(/\s+/g, "").toUpperCase();

  if (compact.includes("/")) {
    const [base, quote] = compact.split("/");
    if (!base || !quote) {
      return compact;
    }

    if (["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "BNB", "LTC", "AVAX", "DOT"].includes(base)) {
      return `${base}-${quote === "USDT" ? "USD" : quote}`;
    }

    if (base === "XAU" && quote === "USD") return "XAUUSD=X";
    if (base === "XAG" && quote === "USD") return "XAGUSD=X";
    return `${base}${quote}=X`;
  }

  const usdPair = compact.match(/^([A-Z0-9]+?)(USD|USDT)$/);
  if (usdPair && ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "BNB", "LTC", "AVAX", "DOT"].includes(usdPair[1])) {
    return `${usdPair[1]}-USD`;
  }

  if (compact.endsWith("=X") || compact.includes("-")) {
    return compact;
  }

  return compact;
}

function mapDecisionToAction(decision: string | undefined): TradingAction {
  const normalized = (decision || "").trim().toLowerCase();

  if (normalized.includes("sell") || normalized.includes("underweight")) {
    return "Sell";
  }

  if (normalized.includes("buy") || normalized.includes("overweight")) {
    return "Buy";
  }

  return "Hold";
}

function confidenceForDecision(decision: string | undefined) {
  const normalized = (decision || "").trim().toLowerCase();
  if (normalized === "buy" || normalized === "sell") return 0.8;
  if (normalized.includes("overweight") || normalized.includes("underweight")) return 0.62;
  return 0.2;
}

function roundPrice(value: number, symbol: string) {
  const compact = symbol.replace(/\s+/g, "").toUpperCase();
  const decimals =
    /JPY/.test(compact) ? 3 : /(?:EUR|GBP|CHF|CAD|AUD|NZD)\/?USD/.test(compact) ? 5 : value < 1 ? 6 : 2;
  return Number(value.toFixed(decimals));
}

function buildRiskBox(params: {
  action: TradingAction;
  symbol: string;
  timeframe: Timeframe;
  marketData?: MarketData;
  baselineOpinion?: TradingOpinion | null;
}) {
  const { action, symbol, timeframe, marketData, baselineOpinion } = params;

  if (action === "Hold") {
    return {};
  }

  if (
    baselineOpinion?.action === action &&
    typeof baselineOpinion.entry === "number" &&
    typeof baselineOpinion.stopLoss === "number" &&
    typeof baselineOpinion.takeProfit === "number"
  ) {
    return {
      entry: baselineOpinion.entry,
      stopLoss: baselineOpinion.stopLoss,
      takeProfit: baselineOpinion.takeProfit,
      supportLevel: baselineOpinion.supportLevel,
      resistanceLevel: baselineOpinion.resistanceLevel,
      invalidationLevel: baselineOpinion.invalidationLevel,
      setupType: baselineOpinion.setupType,
      practicalAnalysis: baselineOpinion.practicalAnalysis,
    };
  }

  const price =
    typeof marketData?.currentPrice === "number"
      ? marketData.currentPrice
      : typeof marketData?.close === "number"
        ? marketData.close
        : undefined;

  if (!price || price <= 0) {
    return {};
  }

  const baseRiskScale =
    timeframe === "M15" || timeframe === "M30"
      ? 0.02
      : timeframe === "H1" || timeframe === "H4"
        ? 0.03
        : 0.04;
  const volatilityPct =
    typeof marketData?.volatilityPct === "number"
      ? marketData.volatilityPct
      : undefined;
  const volatilityRiskScale =
    typeof volatilityPct === "number"
      ? Math.min(0.08, Math.max(0.008, (volatilityPct / 100) * 1.35))
      : baseRiskScale;
  const riskScale = baseRiskScale * 0.35 + volatilityRiskScale * 0.65;
  const rewardScale = riskScale * 2;

  const entry = roundPrice(price, symbol);
  const stopLoss =
    action === "Buy"
      ? roundPrice(price * (1 - riskScale), symbol)
      : roundPrice(price * (1 + riskScale), symbol);
  const takeProfit =
    action === "Buy"
      ? roundPrice(price * (1 + rewardScale), symbol)
      : roundPrice(Math.max(price * (1 - rewardScale), 0.000001), symbol);

  return {
    entry,
    stopLoss,
    takeProfit,
    supportLevel:
      typeof marketData?.recentLow === "number"
        ? roundPrice(marketData.recentLow, symbol)
        : undefined,
    resistanceLevel:
      typeof marketData?.recentHigh === "number"
        ? roundPrice(marketData.recentHigh, symbol)
        : undefined,
    invalidationLevel: stopLoss,
    setupType: action === "Buy" ? "trend" : "reversal",
    practicalAnalysis:
      action === "Buy"
        ? `TradingAgents is bullish; only enter if price holds near ${entry} and respect invalidation at ${stopLoss}.`
        : `TradingAgents is bearish; only enter if price stays weak near ${entry} and respect invalidation at ${stopLoss}.`,
  } satisfies Partial<TradingOpinion>;
}

function buildResearchSummary(
  research: TradingResearchBundle | null | undefined,
  reports: TradingAgentsBridgeResult["reports"]
) {
  const tradingAgentsSummary = compactText(
    [reports?.market, reports?.news, reports?.fundamentals]
      .filter(Boolean)
      .join(" "),
    700
  );

  if (research?.summary) {
    return compactText(
      `${research.summary} TradingAgents context: ${tradingAgentsSummary}`,
      1000
    );
  }

  return tradingAgentsSummary;
}

function buildOpinionFromBridgeResult(params: {
  result: TradingAgentsBridgeResult;
  symbol: string;
  ticker: string;
  timeframe: Timeframe;
  marketData?: MarketData;
  research?: TradingResearchBundle | null;
  baselineOpinion?: TradingOpinion | null;
}): TradingOpinion | null {
  const { result, symbol, ticker, timeframe, marketData, research, baselineOpinion } = params;
  if (!result.ok) {
    return null;
  }

  const decision = result.decision || result.finalDecision;
  const action = mapDecisionToAction(decision);
  const finalDecision = compactText(result.finalDecision, 1100);
  const traderReport = compactText(result.reports?.trader, 500);
  const reasonBase =
    finalDecision ||
    traderReport ||
    `TradingAgents returned a ${decision || "Hold"} portfolio decision.`;
  const riskBox = buildRiskBox({
    action,
    symbol,
    timeframe,
    marketData,
    baselineOpinion,
  });
  const researchSummary = buildResearchSummary(research, result.reports);

  return {
    action,
    confidence: confidenceForDecision(decision),
    reason: `TradingAgents multi-agent decision (${decision || action}) for ${ticker}: ${reasonBase}`,
    symbol,
    timeframe,
    ...riskBox,
    riskNotes:
      action === "Hold"
        ? "TradingAgents did not approve a directional trade. No monitor should be started without a fresh actionable setup."
        : "TradingAgents combines analyst, trader, risk, and portfolio-manager review. Use disciplined position sizing; this is not financial advice.",
    fetchedAt: Date.now(),
    marketDataSource:
      typeof marketData?.marketDataSource === "string"
        ? `${marketData.marketDataSource} + TradingAgents`
        : "TradingAgents",
    researchSummary,
    researchSources: research?.sources,
    researchBias: research?.bias,
    newsSentimentScore: research?.sentimentScore,
    newsBullishCount: research?.bullishSources,
    newsBearishCount: research?.bearishSources,
    newsConsensus: research?.consensus,
    model: `TradingAgents:${result.provider || "unknown"}/${result.deepModel || "default"}`,
    sessionId: `tradingagents-${ticker}-${Date.now()}`,
  };
}

function runTradingAgentsBridge(payload: Record<string, unknown>, provider: TradingAgentsProvider) {
  const python = process.env.TRADINGAGENTS_PYTHON || process.env.PYTHON || "python";
  const scriptPath = path.join(process.cwd(), "scripts", "trading", "tradingagents_bridge.py");
  const timeoutMs = getTimeoutMs();

  return new Promise<TradingAgentsBridgeResult>((resolve) => {
    const child = spawn(python, [scriptPath], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
        TRADINGAGENTS_LLM_PROVIDER:
          process.env.TRADINGAGENTS_LLM_PROVIDER || provider,
      },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (result: TradingAgentsBridgeResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      child.kill();
      finish({
        ok: false,
        error: `TradingAgents timed out after ${timeoutMs}ms`,
        errorType: "Timeout",
      });
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      finish({
        ok: false,
        error: error.message,
        errorType: error.name,
      });
    });

    child.on("close", () => {
      if (settled) return;
      try {
        const parsed = JSON.parse(stdout.trim()) as TradingAgentsBridgeResult;
        finish(parsed);
      } catch {
        finish({
          ok: false,
          error: compactText(stderr || stdout || "TradingAgents produced no JSON output", 1000),
          errorType: "BridgeParseError",
        });
      }
    });

    child.stdin.end(JSON.stringify(payload));
  });
}

export async function computeTradingAgentsOpinion(
  input: TradingAgentsOpinionInput
): Promise<TradingOpinion | null> {
  if (isDisabledByEnv()) {
    return null;
  }

  const provider = resolveProvider();
  if (!provider) {
    return null;
  }

  const ticker = toTradingAgentsTicker(input.symbol);
  const result = await runTradingAgentsBridge(
    {
      symbol: input.symbol,
      ticker,
      timeframe: input.timeframe,
      tradeDate:
        process.env.TRADINGAGENTS_TRADE_DATE ||
        new Date().toISOString().slice(0, 10),
    },
    provider
  );

  if (!result.ok) {
    if (process.env.REARVY_TRADING_DEBUG === "1") {
      console.warn("[tradingagents] bridge skipped", {
        errorType: result.errorType,
        error: result.error,
      });
    }
    return null;
  }

  return buildOpinionFromBridgeResult({
    result,
    symbol: input.symbol,
    ticker,
    timeframe: input.timeframe,
    marketData: input.marketData,
    research: input.research,
    baselineOpinion: input.baselineOpinion,
  });
}
