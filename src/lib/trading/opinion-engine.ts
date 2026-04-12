/**
 * Trading Opinion Engine
 * Computes and validates trading opinions with strict fallback logic
 * Ensures no blind recommendations on stale or missing data
 */

import { TradingOpinion, TradingAction, Timeframe, GuardailConfig } from '@/types/trading';
import type { TradingResearchBundle } from '@/lib/trading/research';

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

    return createFallbackHoldOpinion(
      symbol,
      timeframe,
      `Cannot generate opinion: ${reasons}. Data freshness is critical for accurate analysis.`
    );
  }

  const freshData = marketData as MarketData;
  const price = freshData.currentPrice as number;
  const trend = freshData.trend;
  const rsi = freshData.rsi;
  const macd = freshData.macd;

  const bullishSignals: string[] = [];
  const bearishSignals: string[] = [];

  if (trend === 'up') bullishSignals.push('Trend up');
  if (trend === 'down') bearishSignals.push('Trend down');

  if (typeof macd === 'number') {
    if (macd > 0) bullishSignals.push(`MACD ${macd.toFixed(4)} (>0)`);
    if (macd < 0) bearishSignals.push(`MACD ${macd.toFixed(4)} (<0)`);
  }

  if (typeof rsi === 'number') {
    if (rsi < 35) bullishSignals.push(`RSI ${rsi.toFixed(1)} (oversold)`);
    if (rsi > 65) bearishSignals.push(`RSI ${rsi.toFixed(1)} (overbought)`);
  }

  const bullishCount = bullishSignals.length;
  const bearishCount = bearishSignals.length;
  const directionalSignalCount = bullishCount + bearishCount;

  if (directionalSignalCount < 2) {
    return createFallbackHoldOpinion(
      symbol,
      timeframe,
      `Cannot generate trade: insufficient directional evidence (${directionalSignalCount}/2 minimum). Need at least two independent directional indicators.`
    );
  }

  let action: TradingAction = 'Hold';
  let confidence = 0;

  if (bullishCount === bearishCount) {
    return createFallbackHoldOpinion(
      symbol,
      timeframe,
      `Cannot generate trade: conflicting signals (${bullishCount} bullish vs ${bearishCount} bearish). No clear directional edge.`
    );
  }

  const dominantCount = Math.max(bullishCount, bearishCount);
  const agreementRatio = dominantCount / directionalSignalCount;
  const technicalCoverage = Math.min(directionalSignalCount / 3, 1);

  if (dominantCount >= 2 && agreementRatio >= 0.67) {
    action = bullishCount > bearishCount ? 'Buy' : 'Sell';

    const researchAlignmentBoost =
      research?.sufficient &&
      ((action === 'Buy' && research.bias === 'bullish') ||
        (action === 'Sell' && research.bias === 'bearish'))
        ? 0.12
        : 0;

    confidence = Number(
      Math.min(
        0.93,
        Math.max(0.35, agreementRatio * technicalCoverage + researchAlignmentBoost)
      ).toFixed(2)
    );
  } else {
    return createFallbackHoldOpinion(
      symbol,
      timeframe,
      `Cannot generate trade: directional evidence is weak (${bullishCount} bullish vs ${bearishCount} bearish, agreement ${(agreementRatio * 100).toFixed(0)}%).`
    );
  }

  if (research) {
    if (!research.sufficient) {
      return createFallbackHoldOpinion(
        symbol,
        timeframe,
        `Cannot generate trade: current public research is insufficient. ${research.insufficiencyReason || 'Need multiple recent sources before opening a position.'}`
      );
    }

    if (
      (action === 'Buy' && research.bias !== 'bullish') ||
      (action === 'Sell' && research.bias !== 'bearish')
    ) {
      return createFallbackHoldOpinion(
        symbol,
        timeframe,
        `Cannot generate trade: live technicals suggest ${action}, but current public research is ${research.bias}. No clean alignment.`
      );
    }
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

  const baseReason =
    action === 'Buy'
      ? `${trendText} ${rsiText} ${macdText} Valid trade: ${bullishCount} bullish vs ${bearishCount} bearish signals (agreement ${(agreementRatio * 100).toFixed(0)}%).`
      : `${trendText} ${rsiText} ${macdText} Valid trade: ${bearishCount} bearish vs ${bullishCount} bullish signals (agreement ${(agreementRatio * 100).toFixed(0)}%).`;

  const researchReason = research
    ? ` Public research bias is ${research.bias} across ${research.sources.length} sources.`
    : '';
  const reason = `${baseReason}${researchReason}`;

  const riskNotes = research
    ? `Use disciplined position sizing and respect stop loss. ${research.summary || 'Current public research was reviewed before validating this setup.'}`
    : 'Use disciplined position sizing and respect stop loss. This update is based on live market data and technical evidence only.';

  return {
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
    researchSummary: research?.summary,
    researchSources: research?.sources,
    researchBias: research?.bias,
  };
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
    typeof opinion.entry === 'number' &&
    typeof opinion.stopLoss === 'number' &&
    typeof opinion.takeProfit === 'number' &&
    Array.isArray(opinion.researchSources) &&
    opinion.researchSources.length >= 2 &&
    typeof opinion.researchSummary === 'string' &&
    opinion.researchSummary.trim().length >= 40
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
