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
} from '@/lib/trading/opinion-engine';

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

const BINANCE_INTERVAL_MAP: Record<Timeframe, string> = {
  M15: '15m',
  M30: '30m',
  H1: '1h',
  H4: '4h',
  D1: '1d',
  W1: '1w',
};

function normalizeSymbolForBinance(symbol: string): string {
  const compact = symbol.replace(/[^a-zA-Z]/g, '').toUpperCase();
  if (compact.endsWith('USDT')) return compact;
  if (compact.endsWith('USD')) return `${compact.slice(0, -3)}USDT`;
  return compact;
}

function isLikelyCryptoSymbol(symbol: string): boolean {
  return /\//.test(symbol) || /(BTC|ETH|SOL|XRP|ADA|DOGE|BNB|USDT|USD)$/i.test(symbol);
}

function computeEMA(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const result: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    result.push(values[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

function computeRSI(values: number[], period: number = 14): number | undefined {
  if (values.length <= period) return undefined;
  let gains = 0;
  let losses = 0;

  for (let i = values.length - period; i < values.length; i++) {
    const delta = values[i] - values[i - 1];
    if (delta >= 0) gains += delta;
    else losses += Math.abs(delta);
  }

  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

async function fetchRealtimeCryptoMarketData(symbol: string, timeframe: Timeframe): Promise<MarketData> {
  const pair = normalizeSymbolForBinance(symbol);
  const interval = BINANCE_INTERVAL_MAP[timeframe] ?? '1h';
  const url = `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=120`;

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Binance market data unavailable for ${symbol}`);
  }

  const rows = (await response.json()) as Array<[
    number,
    string,
    string,
    string,
    string,
    string,
    number,
    string,
    number,
    string,
    string,
    string,
  ]>;

  if (!rows.length) {
    throw new Error(`No candles returned for ${symbol}`);
  }

  const closes = rows.map((row) => Number(row[4]));
  const latest = rows[rows.length - 1];
  const ema12 = computeEMA(closes, 12);
  const ema26 = computeEMA(closes, 26);
  const macd =
    ema12.length && ema26.length
      ? ema12[ema12.length - 1] - ema26[ema26.length - 1]
      : undefined;
  const rsi = computeRSI(closes, 14);

  const latestClose = Number(latest[4]);
  const baseline = closes[Math.max(0, closes.length - 20)] ?? latestClose;
  const trendDelta = baseline === 0 ? 0 : (latestClose - baseline) / baseline;
  const trend = trendDelta > 0.002 ? 'up' : trendDelta < -0.002 ? 'down' : 'sideways';

  return {
    symbol,
    currentPrice: latestClose,
    open: Number(latest[1]),
    high: Number(latest[2]),
    low: Number(latest[3]),
    close: latestClose,
    volume: Number(latest[5]),
    rsi,
    macd,
    trend,
    fetchedAt: Date.now(),
  };
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

type TradingOpinionInput = z.infer<typeof TradingOpinionInputSchema>;

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
  return tool({
    description:
      'Generate a Buy/Sell/Hold trading recommendation with confidence level and reasoning. Analyzes technical and fundamental factors. Returns structured JSON opinion only.',
    inputSchema: TradingOpinionInputSchema,
    execute: async (input) => {
      const { symbol, timeframe, marketData } = input;
      let resolvedMarketData = marketData as MarketData | undefined;

      const needsMarketEnrichment =
        !resolvedMarketData?.currentPrice ||
        !resolvedMarketData?.fetchedAt ||
        Date.now() - resolvedMarketData.fetchedAt > 60 * 60 * 1000;

      if (needsMarketEnrichment && isLikelyCryptoSymbol(symbol)) {
        try {
          const liveData = await fetchRealtimeCryptoMarketData(symbol, timeframe as Timeframe);
          resolvedMarketData = {
            ...resolvedMarketData,
            ...liveData,
          };
        } catch (marketError) {
          console.warn('Failed to fetch realtime crypto market data:', marketError);
        }
      }

      try {
        // Step 1: Compute opinion engine (validates data freshness, falls back to Hold if needed)
        const opinion = await computeOpinion(
          symbol,
          timeframe as Timeframe,
          resolvedMarketData
        );

        // Step 2: Validate opinion schema (catch AI deviations)
        const validation = validateOpinion(opinion);
        if (!validation.valid) {
          console.warn('Opinion validation failed:', validation.errors);
          // Return fallback Hold if validation fails
          return createFallbackHoldOpinion(
            symbol,
            timeframe as Timeframe,
            `Opinion validation failed: ${validation.errors.join('; ')}`
          );
        }

        // Step 3: Return opinion (framework will serialize to JSON)
        return opinion;
      } catch (error) {
        // Fallback on any error
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('Trading opinion tool error:', errorMsg);

        return createFallbackHoldOpinion(
          symbol,
          timeframe as Timeframe,
          `Error computing opinion: ${errorMsg}. Defaulting to Hold for safety.`
        );
      }
    },
  });
}

