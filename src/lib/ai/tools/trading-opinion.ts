/**
 * Trading Opinion Tool
 * AI tool that generates Buy/Sell/Hold recommendations
 * Uses OpenAI JSON mode for guaranteed schema compliance
 * Integrated with Genkit/ai library pattern
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from "../types";
import { TradingOpinion, Timeframe } from '@/types/trading';
import {
  computeOpinion,
  validateOpinion,
  createFallbackHoldOpinion,
  MarketData,
  isActionableTradingOpinion,
} from '@/lib/trading/opinion-engine';
import { fetchLiveMarketData } from '@/lib/trading/market-data';
import { fetchTradingResearch } from '@/lib/trading/research';
import { computeTradingAgentsOpinion } from '@/lib/trading/tradingagents-adapter';

type TradeCandidate = {
  symbol: string;
  timeframe: Timeframe;
  marketData?: MarketData;
};

function normalizeTimeframeInput(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const normalized = value.trim().toUpperCase();
  const aliases: Record<string, Timeframe> = {
    '15M': 'M15',
    M15: 'M15',
    '30M': 'M30',
    M30: 'M30',
    '1H': 'H1',
    H1: 'H1',
    '4H': 'H4',
    H4: 'H4',
    '1D': 'D1',
    D1: 'D1',
    '1W': 'W1',
    W1: 'W1',
  };

  return aliases[normalized] ?? value;
}

async function resolveAndComputeOpinion(
  candidate: TradeCandidate,
  options: { useTradingAgents?: boolean } = {}
): Promise<TradingOpinion> {
  const { symbol, timeframe, marketData } = candidate;
  let resolvedMarketData = marketData as MarketData | undefined;

  // Always fetch fresh symbol-specific market data when available.
  // This avoids reused/templated input data causing identical outcomes across assets.
  try {
    const liveData = await fetchLiveMarketData(symbol, timeframe);
    resolvedMarketData = {
      ...resolvedMarketData,
      ...liveData,
    };
  } catch (marketError) {
    console.warn('Failed to fetch live market data:', marketError);
  }

  try {
    const research = await fetchTradingResearch(symbol);
    const baselineOpinion = await computeOpinion(
      symbol,
      timeframe,
      resolvedMarketData,
      research
    );

    const tradingAgentsOpinion = options.useTradingAgents === false
      ? null
      : await computeTradingAgentsOpinion({
          symbol,
          timeframe,
          marketData: resolvedMarketData,
          research,
          baselineOpinion,
        });

    const opinion = tradingAgentsOpinion ?? baselineOpinion;
    const validation = validateOpinion(opinion);

    if (!validation.valid) {
      if (tradingAgentsOpinion) {
        const baselineValidation = validateOpinion(baselineOpinion);
        if (baselineValidation.valid) {
          console.warn('TradingAgents opinion failed validation; using Rearvy fallback engine', {
            symbol,
            timeframe,
            errors: validation.errors,
          });
          return baselineOpinion;
        }
      }

      return createFallbackHoldOpinion(
        symbol,
        timeframe,
        `Opinion validation failed: ${validation.errors.join('; ')}`
      );
    }

    return opinion;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return createFallbackHoldOpinion(
      symbol,
      timeframe,
      `Error computing opinion: ${errorMsg}. Defaulting to Hold for safety.`
    );
  }
}

/**
 * Zod schema for tool input validation
 */
const TradingOpinionInputSchema = z.object({
  symbol: z.string().describe('Trading symbol, e.g., "BTC/USD", "AAPL"'),
  timeframe: z.preprocess(
    normalizeTimeframeInput,
    z.enum(['M15', 'M30', 'H1', 'H4', 'D1', 'W1'])
  ).describe('Time frame for analysis'),
  marketData: z
    .object({
      currentPrice: z.number().optional(),
      open: z.number().optional(),
      high: z.number().optional(),
      low: z.number().optional(),
      close: z.number().optional(),
      volume: z.number().optional(),
      rsi: z.number().optional(),
      macd: z.number().optional(),
      trend: z.enum(['up', 'down', 'sideways']).optional(),
      fetchedAt: z.number().optional(),
    })
    .optional()
    .describe('Market data to analyze (price, indicators, etc.)'),
});

const BestTradeInputSchema = z.object({
  candidates: z.array(
    z.object({
      symbol: z.string(),
      timeframe: z.preprocess(
        normalizeTimeframeInput,
        z.enum(['M15', 'M30', 'H1', 'H4', 'D1', 'W1'])
      ),
      marketData: z
        .object({
          currentPrice: z.number().optional(),
          open: z.number().optional(),
          high: z.number().optional(),
          low: z.number().optional(),
          close: z.number().optional(),
          volume: z.number().optional(),
          rsi: z.number().optional(),
          macd: z.number().optional(),
          trend: z.enum(['up', 'down', 'sideways']).optional(),
          fetchedAt: z.number().optional(),
        })
        .optional(),
    })
  ).max(20).optional(),
  symbols: z.array(z.string()).max(20).optional(),
  timeframe: z.preprocess(
    normalizeTimeframeInput,
    z.enum(['M15', 'M30', 'H1', 'H4', 'D1', 'W1'])
  ).optional(),
}).describe('Find the single best actionable trade from candidates. Returns no-trade when no valid setup exists.');

/**
 * Trading opinion tool for generating Buy/Sell/Hold recommendations
 * 
 * Usage:
 *   Call this tool with symbol, timeframe, and optional market data
 *   Returns JSON opinion with confidence, reasoning, and entry/exit levels
 * 
 * Pattern: Follows existing Rearvy tool conventions (revenue.ts, etc.)
 */
export function getTradingOpinionTool(ctx: ToolContext) {
  void ctx;

  return tool({
    description:
      'Generate a Buy/Sell/Hold trading recommendation using live market data and current public research. Only return Buy or Sell when the setup is supported by real multi-source evidence.',
    inputSchema: TradingOpinionInputSchema,
    execute: async (input) => {
      const { symbol, timeframe, marketData } = input;
      return resolveAndComputeOpinion({
        symbol,
        timeframe: timeframe as Timeframe,
        marketData: marketData as MarketData | undefined,
      });
    },
  });
}

export function getBestTradeOpportunityTool(ctx: ToolContext) {
  void ctx;

  return tool({
    description:
      'Find the best single trade with the highest evidence-weighted profit potential. Use when user asks which trade to take or best trade right now. Returns no-trade if no valid setup exists.',
    inputSchema: BestTradeInputSchema,
    execute: async (input) => {
      const defaultSymbols = ['BTC/USD', 'ETH/USD', 'SOL/USD', 'BNB/USD', 'XRP/USD', 'ADA/USD'];
      const defaultTimeframes: Timeframe[] = ['H1', 'H4'];

      const candidateList: TradeCandidate[] = input.candidates
        ? input.candidates.map((candidate) => ({
            symbol: candidate.symbol,
            timeframe: candidate.timeframe as Timeframe,
            marketData: candidate.marketData as MarketData | undefined,
          }))
        : (input.symbols && input.symbols.length > 0
            ? input.symbols
            : defaultSymbols
          ).flatMap((symbol) =>
            input.timeframe
              ? [{ symbol, timeframe: input.timeframe as Timeframe }]
              : defaultTimeframes.map((timeframe) => ({ symbol, timeframe }))
          );

      if (!candidateList.length) {
        return {
          action: 'Hold' as const,
          confidence: 0,
          reason: 'No candidates supplied for evaluation. No trade recommended.',
          bestTrade: null,
          rankedCandidates: [],
          evaluatedAt: Date.now(),
        };
      }

      const useTradingAgents = candidateList.length <= 3;
      const opinions = await Promise.all(
        candidateList.map((candidate) =>
          resolveAndComputeOpinion(candidate, { useTradingAgents })
        )
      );

      const actionable = opinions
        .filter((opinion) => isActionableTradingOpinion(opinion))
        .map((opinion) => {
          const entry = opinion.entry as number;
          const stopLoss = opinion.stopLoss as number;
          const takeProfit = opinion.takeProfit as number;

          const potentialReturnPct = opinion.action === 'Buy'
            ? (takeProfit - entry) / entry
            : (entry - takeProfit) / entry;

          const potentialRiskPct = opinion.action === 'Buy'
            ? (entry - stopLoss) / entry
            : (stopLoss - entry) / entry;

          const riskReward = potentialRiskPct > 0 ? potentialReturnPct / potentialRiskPct : 0;
          const opportunityScore = Number((potentialReturnPct * opinion.confidence).toFixed(6));

          return {
            opinion,
            potentialReturnPct: Number((potentialReturnPct * 100).toFixed(2)),
            potentialRiskPct: Number((potentialRiskPct * 100).toFixed(2)),
            riskReward: Number(riskReward.toFixed(2)),
            opportunityScore,
          };
        })
        .sort((a, b) => {
          if (b.opportunityScore !== a.opportunityScore) {
            return b.opportunityScore - a.opportunityScore;
          }
          if (b.opinion.confidence !== a.opinion.confidence) {
            return b.opinion.confidence - a.opinion.confidence;
          }
          return b.riskReward - a.riskReward;
        });

      if (!actionable.length) {
        return {
          action: 'Hold' as const,
          confidence: 0,
          reason: 'No valid trade found across evaluated candidates. Signals are weak or conflicting, so no trade is recommended.',
          bestTrade: null,
          rankedCandidates: opinions.map((opinion) => ({
            symbol: opinion.symbol,
            timeframe: opinion.timeframe,
            action: opinion.action,
            confidence: opinion.confidence,
            reason: opinion.reason,
          })),
          evaluatedAt: Date.now(),
        };
      }

      const winner = actionable[0];
      const rankedCandidates = actionable.slice(0, 5).map((entry) => ({
        symbol: entry.opinion.symbol,
        timeframe: entry.opinion.timeframe,
        action: entry.opinion.action,
        confidence: entry.opinion.confidence,
        entry: entry.opinion.entry,
        stopLoss: entry.opinion.stopLoss,
        takeProfit: entry.opinion.takeProfit,
        potentialReturnPct: entry.potentialReturnPct,
        potentialRiskPct: entry.potentialRiskPct,
        riskReward: entry.riskReward,
        opportunityScore: entry.opportunityScore,
        reason: entry.opinion.reason,
      }));

      return {
        action: winner.opinion.action,
        confidence: winner.opinion.confidence,
        reason: `Best trade selected from ${candidateList.length} candidates using evidence-weighted opportunity score (expected return % x confidence).`,
        bestTrade: {
          symbol: winner.opinion.symbol,
          timeframe: winner.opinion.timeframe,
          action: winner.opinion.action,
          confidence: winner.opinion.confidence,
          entry: winner.opinion.entry,
          stopLoss: winner.opinion.stopLoss,
          takeProfit: winner.opinion.takeProfit,
          potentialReturnPct: winner.potentialReturnPct,
          potentialRiskPct: winner.potentialRiskPct,
          riskReward: winner.riskReward,
          opportunityScore: winner.opportunityScore,
          reasoning: winner.opinion.reason,
          riskNotes: winner.opinion.riskNotes,
          fetchedAt: winner.opinion.fetchedAt,
        },
        rankedCandidates,
        evaluatedAt: Date.now(),
      };
    },
  });
}

