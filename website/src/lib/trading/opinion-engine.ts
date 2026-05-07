/**
 * Trading Opinion Engine
 * Computes and validates trading opinions with strict fallback logic
 * Ensures no blind recommendations on stale or missing data
 */

import { TradingOpinion, TradingAction, Timeframe, GuardailConfig } from '@/types/trading';
import type { TradingResearchBundle } from '@/lib/trading/research';
import { formatTradingPrice } from '@/lib/trading/price-format';

/**
 * Default guardrail configuration
 */
export const DEFAULT_GUARDRAILS: GuardailConfig = {
  maxMonitorsPerUser: 3,
  minPollingIntervalMs: 60000, // 60 seconds
  confidenceThresholdForUpdate: 0.1, // 10%
  stalePlanetDataThresholdMs: 3600000, // 1 hour
  maxErrorCountBeforePause: 3,
  maxBackoffIntervalMs: 3600000, // 1 hour
  auditLogRetentionDays: 90,
};

export interface MarketData {
  symbol: string;
  currentPrice?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  rsi?: number;
  macd?: number;
  trend?: 'up' | 'down' | 'sideways';
  fetchedAt?: number;
  [key: string]: unknown; // Allow extension for additional indicators
}

/**
 * Validate that fetched market data is fresh enough
 * @returns true if data is fresh, false if stale
 */
export function isDataFresh(
  fetchedAt: number | undefined,
  stalePlanetDataThresholdMs: number = DEFAULT_GUARDRAILS.stalePlanetDataThresholdMs
): boolean {
  if (!fetchedAt) return false;
  const now = Date.now();
  return now - fetchedAt < stalePlanetDataThresholdMs;
}

/**
 * Check if market data is sufficient for making an opinion
 * @returns { sufficient: boolean, missingFields: string[] }
 */
export function validateMarketData(data: MarketData | undefined): {
  sufficient: boolean;
  missingFields: string[];
} {
  if (!data) {
    return {
      sufficient: false,
      missingFields: ['data'],
    };
  }

  const required = ['currentPrice'];
  const missing = required.filter(field => data[field] === undefined || data[field] === null);

  return {
    sufficient: missing.length === 0 && isDataFresh(data.fetchedAt),
    missingFields: missing,
  };
}

/**
 * Create a fallback Hold opinion when data is insufficient
 * @param symbol - Trading symbol
 * @param timeframe - Time frame
 * @param reason - Explanation of why Hold was chosen
 * @returns TradingOpinion with action=Hold
 */
export function createFallbackHoldOpinion(
  symbol: string,
  timeframe: Timeframe,
  reason: string
): TradingOpinion {
  return {
    action: 'Hold',
    confidence: 0,
    reason,
    symbol,
    timeframe,
    riskNotes: 'No recommendation issued. Data insufficient or stale. Risk of acting on incomplete information.',
    fetchedAt: Date.now(),
    stopLoss: undefined,
    takeProfit: undefined,
    entry: undefined,
  };
}

function withResearchTelemetry(
  opinion: TradingOpinion,
  research?: TradingResearchBundle | null
): TradingOpinion {
  if (!research) {
    return opinion;
  }

  return {
    ...opinion,
    researchSummary: research.summary,
    researchSources: research.sources,
    researchBias: research.bias,
    newsSentimentScore: research.sentimentScore,
    newsBullishCount: research.bullishSources,
    newsBearishCount: research.bearishSources,
    newsConsensus: research.consensus,
  };
}

function getResearchTelemetryText(research?: TradingResearchBundle | null): string {
  if (!research) {
    return '';
  }

  const score = research.sentimentScore >= 0
    ? `+${research.sentimentScore.toFixed(2)}`
    : research.sentimentScore.toFixed(2);

  return ` News calc: score ${score} (${research.bullishSources} bullish, ${research.bearishSources} bearish across ${research.sources.length} sources).`;
}

function getSourceLine(params: {
  marketDataSource?: string;
  research?: TradingResearchBundle | null;
}): string {
  const marketSource = (params.marketDataSource || '').trim();
  const researchSources = [...new Set(
    (params.research?.sources ?? [])
      .map((source) => source.source?.trim())
      .filter((value): value is string => Boolean(value))
  )];

  const parts: string[] = [];

  if (marketSource) {
    parts.push(`Market data: ${marketSource}.`);
  }

  if (researchSources.length > 0) {
    const displayedSources = researchSources.slice(0, 5);
    const remaining = researchSources.length - displayedSources.length;
    parts.push(
      `Research sources: ${displayedSources.join(', ')}${remaining > 0 ? ` (+${remaining} more)` : ''}.`
    );
  } else if (params.research) {
    parts.push('Research sources: none found.');
  }

  if (parts.length === 0) {
    return '';
  }

  return ` ${parts.join(' ')}`;
}

function buildPracticalAnalysis(params: {
  symbol?: string;
  action: TradingAction;
  price: number;
  trend?: 'up' | 'down' | 'sideways';
  ema20?: number;
  ema50?: number;
  momentumPct?: number;
  resistanceLevel?: number;
  supportLevel?: number;
  invalidationLevel?: number;
  research?: TradingResearchBundle | null;
}): {
  practicalAnalysis: string;
  setupType: 'trend' | 'reversal' | 'breakout' | 'mean_reversion' | 'wait';
  supportLevel?: number;
  resistanceLevel?: number;
  invalidationLevel?: number;
} {
  const trendUp = params.trend === 'up';
  const trendDown = params.trend === 'down';
  const emaAlignedUp =
    typeof params.ema20 === 'number' && typeof params.ema50 === 'number'
      ? params.ema20 > params.ema50
      : false;
  const emaAlignedDown =
    typeof params.ema20 === 'number' && typeof params.ema50 === 'number'
      ? params.ema20 < params.ema50
      : false;
  const momentumUp = typeof params.momentumPct === 'number' ? params.momentumPct > 0 : false;
  const momentumDown = typeof params.momentumPct === 'number' ? params.momentumPct < 0 : false;

  const supportLevel =
    params.supportLevel ??
    (typeof params.ema20 === 'number' ? params.ema20 : params.price * 0.995);
  const resistanceLevel =
    params.resistanceLevel ??
    (typeof params.ema20 === 'number' ? Math.max(params.price, params.ema20) * 1.005 : params.price * 1.005);
  const invalidationLevel =
    params.invalidationLevel ??
    (params.action === 'Buy'
      ? supportLevel * 0.997
      : params.action === 'Sell'
        ? resistanceLevel * 1.003
        : params.price * 0.995);
  const formatPrice = (value: number | undefined) => formatTradingPrice(value, params.symbol);

  if (params.action === 'Buy') {
    const setupType = trendUp || emaAlignedUp || momentumUp ? 'trend' : 'breakout';
    return {
      setupType,
      supportLevel,
      resistanceLevel,
      invalidationLevel,
      practicalAnalysis: `Bias: bullish. Trigger: only buy on a hold above ${formatPrice(supportLevel)} with momentum confirmation. Target: ${formatPrice(resistanceLevel)} first, then trail if breakout continues. Invalidation: below ${formatPrice(invalidationLevel)}.`,
    };
  }

  if (params.action === 'Sell') {
    const setupType = trendDown || emaAlignedDown || momentumDown ? 'trend' : 'reversal';
    return {
      setupType,
      supportLevel,
      resistanceLevel,
      invalidationLevel,
      practicalAnalysis: `Bias: bearish. Trigger: only sell if price stays below ${formatPrice(resistanceLevel)} and loses momentum. Target: ${formatPrice(supportLevel)} first, then extend if breakdown expands. Invalidation: above ${formatPrice(invalidationLevel)}.`,
    };
  }

  return {
    setupType: 'wait',
    supportLevel,
    resistanceLevel,
    invalidationLevel,
    practicalAnalysis: `Bias: neutral. Trigger: wait for a break above ${formatPrice(resistanceLevel)} for upside or below ${formatPrice(supportLevel)} for downside. Plan: no trade until price proves direction. Invalidation: the opposite side of the range is still intact.`,
  };
}

/**
 * Compute a trading opinion from market data
 * Enforces guardrails: falls back to Hold on stale/missing data
 * 
 * @param symbol - Trading symbol (e.g., "BTC/USD")
 * @param timeframe - Timeframe (e.g., "H1", "D1")
 * @param marketData - Market data object (price, indicators, etc.)
 * @param config - Optional guardrail configuration
 * @returns TradingOpinion (may have action=Hold if data insufficient)
 */
export async function computeOpinion(
  symbol: string,
  timeframe: Timeframe,
  marketData?: MarketData,
  research?: TradingResearchBundle | null,
  _config: GuardailConfig = DEFAULT_GUARDRAILS
): Promise<TradingOpinion> {
  void _config;

  // Validate market data is fresh and sufficient
  const validation = validateMarketData(marketData);

  if (!validation.sufficient) {
    const reasons = validation.missingFields.length > 0
      ? `Missing data fields: ${validation.missingFields.join(', ')}`
      : 'Data is stale (>1 hour old)';

    const opinion = createFallbackHoldOpinion(
      symbol,
      timeframe,
      `Cannot generate opinion: ${reasons}. Data freshness is critical for accurate analysis.${getResearchTelemetryText(research)}`
    );

    return withResearchTelemetry(opinion, research);
  }

  const freshData = marketData as MarketData;
  const price = freshData.currentPrice as number;
  const trend = freshData.trend;
  const rsi = freshData.rsi;
  const macd = freshData.macd;
  const ema20 = typeof freshData.ema20 === 'number' ? freshData.ema20 : undefined;
  const ema50 = typeof freshData.ema50 === 'number' ? freshData.ema50 : undefined;
  const momentumPct =
    typeof freshData.momentumPct === 'number' ? freshData.momentumPct : undefined;
  const breakoutAboveRecentHigh = freshData.breakoutAboveRecentHigh === true;
  const breakdownBelowRecentLow = freshData.breakdownBelowRecentLow === true;
  const volumeRatio =
    typeof freshData.volumeRatio === 'number' ? freshData.volumeRatio : undefined;
  const recentHigh = typeof freshData.recentHigh === 'number' ? freshData.recentHigh : undefined;
  const recentLow = typeof freshData.recentLow === 'number' ? freshData.recentLow : undefined;

  const signalContributions: Array<{ label: string; weight: number }> = [];
  const addSignal = (label: string, weight: number) => {
    signalContributions.push({ label, weight });
  };

  if (trend === 'up') addSignal('Trend up', 1.25);
  if (trend === 'down') addSignal('Trend down', -1.25);

  if (typeof macd === 'number') {
    if (macd > 0) addSignal(`MACD ${macd.toFixed(4)} (>0)`, 1);
    if (macd < 0) addSignal(`MACD ${macd.toFixed(4)} (<0)`, -1);
  }

  if (typeof rsi === 'number') {
    if (rsi < 35) addSignal(`RSI ${rsi.toFixed(1)} (oversold)`, 0.75);
    if (rsi > 65) addSignal(`RSI ${rsi.toFixed(1)} (overbought)`, -0.75);
  }

  if (typeof ema20 === 'number' && typeof ema50 === 'number') {
    if (ema20 > ema50) addSignal('EMA20 above EMA50', 1);
    if (ema20 < ema50) addSignal('EMA20 below EMA50', -1);
  }

  if (typeof ema20 === 'number') {
    if (price > ema20) addSignal('Price holding above EMA20', 0.5);
    if (price < ema20) addSignal('Price trading below EMA20', -0.5);
  }

  if (typeof momentumPct === 'number') {
    if (momentumPct >= 0.8) addSignal(`Momentum +${momentumPct.toFixed(2)}%`, 0.5);
    if (momentumPct <= -0.8) addSignal(`Momentum ${momentumPct.toFixed(2)}%`, -0.5);
  }

  if (breakoutAboveRecentHigh) {
    addSignal('Breakout above recent structure high', 1);
  }

  if (breakdownBelowRecentLow) {
    addSignal('Breakdown below recent structure low', -1);
  }

  if (typeof volumeRatio === 'number' && volumeRatio >= 1.15) {
    if (trend === 'up') {
      addSignal(`Volume confirms upside (${volumeRatio.toFixed(2)}x avg)`, 0.5);
    } else if (trend === 'down') {
      addSignal(`Volume confirms downside (${volumeRatio.toFixed(2)}x avg)`, -0.5);
    }
  }

  const technicalScore = Number(
    signalContributions.reduce((sum, signal) => sum + signal.weight, 0).toFixed(2)
  );
  const signalCount = signalContributions.length;

  if (signalCount < 2) {
    return withResearchTelemetry(
      createFallbackHoldOpinion(
        symbol,
        timeframe,
        `Cannot generate trade: insufficient technical evidence (${signalCount}/2 minimum). Need more than one independent market signal.${getResearchTelemetryText(research)}`
      ),
      research
    );
  }

  const minTechnicalScore = research?.sufficient ? 1.8 : 2.2;

  if (Math.abs(technicalScore) < minTechnicalScore) {
    return withResearchTelemetry(
      createFallbackHoldOpinion(
        symbol,
        timeframe,
        `Cannot generate trade: technical score is too weak (${technicalScore.toFixed(2)}). The signal mix does not justify a trade.${getResearchTelemetryText(research)}`
      ),
      research
    );
  }

  const action: TradingAction = technicalScore > 0 ? 'Buy' : 'Sell';
  let confidence = 0;

  const isForexOrMetal = /(?:XAU|XAG|EUR|GBP|JPY|CHF|CAD|AUD|NZD)\/?(?:USD|JPY|CHF|CAD|AUD|NZD|GBP|EUR)/i.test(
    symbol.replace(/\s+/g, "").toUpperCase()
  );

  if (research) {
    if (!research.sufficient) {
      const canProceedWithTechnicalOnly =
        isForexOrMetal &&
        Math.abs(technicalScore) >= 2.5;

      if (canProceedWithTechnicalOnly) {
        confidence = Number(Math.max(0.3, confidence - 0.08).toFixed(2));
      } else {
        return withResearchTelemetry(
          createFallbackHoldOpinion(
            symbol,
            timeframe,
            `Cannot generate trade: current public research is insufficient. ${research.insufficiencyReason || 'Need multiple recent sources before opening a position.'}${getResearchTelemetryText(research)}`
          ),
          research
        );
      }

      // For forex/metals with strong technical confirmation, allow a practical setup
      // while clearly disclosing that live news validation was unavailable.
      if (isForexOrMetal) {
        const gap = ` Public-news validation was unavailable, so this is technical-only with reduced confidence.`;
        const existingReason = `Cannot generate trade: current public research is insufficient. ${research.insufficiencyReason || 'Need multiple recent sources before opening a position.'}${getResearchTelemetryText(research)}`;
        if (!existingReason.includes('technical-only')) {
          // Preserve traceability by appending disclosure into risk notes later.
          (freshData as MarketData & { technicalOnlyNote?: string }).technicalOnlyNote = gap;
        }
      }
    }

    if (
      (action === 'Buy' && research.bias !== 'bullish') ||
      (action === 'Sell' && research.bias !== 'bearish')
    ) {
      return withResearchTelemetry(
        createFallbackHoldOpinion(
          symbol,
          timeframe,
          `Cannot generate trade: live technicals suggest ${action}, but current public research is ${research.bias}. No clean alignment.${getResearchTelemetryText(research)}`
        ),
        research
      );
    }

    const researchAlignmentBoost =
      research.sufficient &&
      ((action === 'Buy' && research.bias === 'bullish') ||
        (action === 'Sell' && research.bias === 'bearish'))
        ? 0.12
        : 0;

    confidence = Number(
      Math.min(
        0.93,
        Math.max(0.35, Math.min(1, Math.abs(technicalScore) / 4) + researchAlignmentBoost)
      ).toFixed(2)
    );
  } else {
    confidence = Number(Math.min(0.9, Math.max(0.35, Math.abs(technicalScore) / 4)).toFixed(2));
  }

  const baseRiskScale = timeframe === 'M15' || timeframe === 'M30'
    ? 0.02
    : timeframe === 'H1' || timeframe === 'H4'
      ? 0.03
      : 0.04;

  const volatilityPct =
    typeof freshData.volatilityPct === 'number' ? freshData.volatilityPct : undefined;

  const volatilityRiskScale =
    typeof volatilityPct === 'number'
      ? Math.min(0.08, Math.max(0.008, (volatilityPct / 100) * 1.35))
      : baseRiskScale;

  const riskScale = Number(
    (baseRiskScale * 0.35 + volatilityRiskScale * 0.65).toFixed(4)
  );

  const rewardMultiple = research?.sufficient ? 2.1 : 1.8;
  const rewardScale = Number((riskScale * rewardMultiple).toFixed(4));

  let entry = price;
  let stopLoss: number | undefined;
  let takeProfit: number | undefined;

  if (action === 'Buy') {
    stopLoss = Number((price * (1 - riskScale)).toFixed(2));
    takeProfit = Number((price * (1 + rewardScale)).toFixed(2));
  } else if (action === 'Sell') {
    stopLoss = Number((price * (1 + riskScale)).toFixed(2));
    takeProfit = Number(Math.max(price * (1 - rewardScale), 0.01).toFixed(2));
  } else {
    entry = Number(price.toFixed(2));
    stopLoss = Number((price * (1 - riskScale)).toFixed(2));
    takeProfit = Number((price * (1 + rewardScale)).toFixed(2));
  }

  const trendText = trend ? `Trend is ${trend}.` : 'Trend signal unavailable.';
  const rsiText = typeof rsi === 'number' ? `RSI ${rsi.toFixed(1)}.` : 'RSI unavailable.';
  const macdText = typeof macd === 'number' ? `MACD ${macd.toFixed(4)}.` : 'MACD unavailable.';

  const baseReason = `${trendText} ${rsiText} ${macdText} Technical score ${technicalScore.toFixed(2)} supports ${action.toLowerCase()} setup.`;

  const researchReason = research
    ? ` Public research bias is ${research.bias} across ${research.sources.length} sources.${getResearchTelemetryText(research)}${getSourceLine({ marketDataSource: freshData.marketDataSource as string | undefined, research })}`
    : '';
  const reason = `${baseReason}${researchReason}`;

  const riskNotes = research
    ? `Use disciplined position sizing and respect stop loss. ${research.summary || 'Current public research was reviewed before validating this setup.'}${
        (freshData as MarketData & { technicalOnlyNote?: string }).technicalOnlyNote || ''
      }`
    : 'Use disciplined position sizing and respect stop loss. This update is based on live market data and technical evidence only.';

  const practical = buildPracticalAnalysis({
    symbol,
    action,
    price,
    trend,
    ema20,
    ema50,
    momentumPct,
    resistanceLevel: recentHigh,
    supportLevel: recentLow,
    invalidationLevel: action === 'Buy' ? stopLoss : action === 'Sell' ? stopLoss : undefined,
    research,
  });

  return withResearchTelemetry({
    action,
    confidence,
    reason,
    symbol,
    timeframe,
    entry,
    stopLoss,
    takeProfit,
    riskNotes,
    fetchedAt: freshData.fetchedAt || Date.now(),
    marketDataSource:
      typeof freshData.marketDataSource === 'string'
        ? freshData.marketDataSource
        : undefined,
    practicalAnalysis: practical.practicalAnalysis,
    setupType: practical.setupType,
    supportLevel: practical.supportLevel,
    resistanceLevel: practical.resistanceLevel,
    invalidationLevel: practical.invalidationLevel,
  }, research);
}

/**
 * Validate that an opinion follows schema and guardrails
 * Called after receiving opinion from AI model to catch any deviations
 * 
 * @param opinion - Opinion from AI model
 * @param config - Guardrail configuration
 * @returns { valid: boolean, errors: string[] }
 */
export function validateOpinion(
  opinion: Partial<TradingOpinion>,
  _config: GuardailConfig = DEFAULT_GUARDRAILS
): { valid: boolean; errors: string[] } {
  void _config;

  const errors: string[] = [];
  const action = opinion.action;
  const reason = typeof opinion.reason === 'string' ? opinion.reason : '';

  // Check required fields
  if (typeof action !== 'string' || !['Buy', 'Sell', 'Hold'].includes(action)) {
    errors.push(`action must be Buy/Sell/Hold, got: ${String(action)}`);
  }

  if (typeof opinion.confidence !== 'number' || opinion.confidence < 0 || opinion.confidence > 1) {
    errors.push(`confidence must be number between 0-1, got: ${opinion.confidence}`);
  }

  if (reason.length === 0) {
    errors.push('reason must be non-empty string');
  }

  if (!opinion.symbol || typeof opinion.symbol !== 'string') {
    errors.push('symbol must be non-empty string');
  }

  if (!opinion.timeframe) {
    errors.push('timeframe must be specified');
  }

  if (typeof opinion.fetchedAt !== 'number') {
    errors.push('fetchedAt must be unix timestamp');
  }

  if (action !== 'Hold') {
    if (!Array.isArray(opinion.researchSources) || opinion.researchSources.length < 2) {
      errors.push('actionable trades require at least two researchSources');
    }

    if (typeof opinion.researchSummary !== 'string' || opinion.researchSummary.trim().length < 40) {
      errors.push('actionable trades require a meaningful researchSummary');
    }
  }

  // Optional numeric fields validation
  if (opinion.entry && typeof opinion.entry !== 'number') {
    errors.push('entry must be number if provided');
  }

  if (opinion.stopLoss && typeof opinion.stopLoss !== 'number') {
    errors.push('stopLoss must be number if provided');
  }

  if (opinion.takeProfit && typeof opinion.takeProfit !== 'number') {
    errors.push('takeProfit must be number if provided');
  }

  // Guardrail: no profit promises in reason
  const profitPromisePatterns = [
    /\byou will make money\b/i,
    /\bguaranteed\s+profit\b/i,
    /\bsafe\s+trade\b/i,
    /\bcertain\b.*\bprofit\b/i,
    /\bresult\s+in\s+profit\b/i,
  ];

  for (const pattern of profitPromisePatterns) {
    if (pattern.test(reason)) {
      errors.push(`reason contains prohibited profit promise: "${pattern.source}"`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function isActionableTradingOpinion(opinion: Partial<TradingOpinion> | null | undefined): boolean {
  if (!opinion) return false;

  return (
    opinion.action !== 'Hold' &&
    typeof opinion.confidence === 'number' &&
    opinion.confidence > 0 &&
    typeof opinion.reason === 'string' &&
    opinion.reason.trim().length >= 12 &&
    typeof opinion.entry === 'number' &&
    typeof opinion.stopLoss === 'number' &&
    typeof opinion.takeProfit === 'number'
  );
}

/**
 * Determine if a confidence change warrants a monitor update
 * Prevents spam from minor fluctuations
 * 
 * @param oldConfidence - Previous confidence
 * @param newConfidence - New confidence
 * @param threshold - Absolute confidence delta threshold (default 10%)
 * @returns true if update should be sent
 */
export function shouldUpdateOnConfidenceChange(
  oldConfidence: number | undefined,
  newConfidence: number,
  threshold: number = DEFAULT_GUARDRAILS.confidenceThresholdForUpdate
): boolean {
  if (oldConfidence === undefined) return true; // First time
  return Math.abs(newConfidence - oldConfidence) >= threshold;
}

/**
 * Calculate next poll time using reactive polling strategy
 * Balances freshness vs cost
 * 
 * @param timeSinceLastActionMs - How long since last action changed
 * @param baseIntervalMs - Base polling interval (default 60s)
 * @param errorCount - Consecutive error count for backoff
 * @returns Next poll time in milliseconds from now
 */
export function calculateNextPollInterval(
  timeSinceLastActionMs: number = 0,
  baseIntervalMs: number = DEFAULT_GUARDRAILS.minPollingIntervalMs,
  errorCount: number = 0,
  config: GuardailConfig = DEFAULT_GUARDRAILS
): number {
  // If there are errors, apply exponential backoff
  if (errorCount > 0) {
    const backoffInterval = Math.min(
      baseIntervalMs * Math.pow(2, errorCount - 1),
      config.maxBackoffIntervalMs
    );
    return backoffInterval;
  }

  // After significant change, poll more frequently
  if (timeSinceLastActionMs < 5 * 60 * 1000) {
    // Within 5 minutes of last action change: poll every 30s
    return 30000;
  }

  // Quiet periods: slow down polling to save costs
  if (timeSinceLastActionMs < 30 * 60 * 1000) {
    // Within 30 minutes: 60s interval
    return 60000;
  }

  if (timeSinceLastActionMs < 2 * 60 * 60 * 1000) {
    // Within 2 hours: 120s interval
    return 120000;
  }

  // Very quiet: max out at 15 minutes
  return Math.min(baseIntervalMs * 15, 15 * 60 * 1000);
}
