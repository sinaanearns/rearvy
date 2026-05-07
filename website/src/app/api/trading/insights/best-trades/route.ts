import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/firebase/middleware';
import { computeOpinion, MarketData } from '@/lib/trading/opinion-engine';
import { fetchTradingResearch } from '@/lib/trading/research';
import { Timeframe } from '@/types/trading';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BINANCE_INTERVAL_MAP: Record<Timeframe, string> = {
  M15: '15m',
  M30: '30m',
  H1: '1h',
  H4: '4h',
  D1: '1d',
  W1: '1w',
};

const DEFAULT_SYMBOLS = ['BTC/USD', 'ETH/USD', 'SOL/USD', 'BNB/USD', 'XRP/USD', 'ADA/USD'];
const DEFAULT_TIMEFRAMES: Timeframe[] = ['H1', 'H4'];
const LIVE_FRESHNESS_MS = 2 * 60 * 1000;

function normalizeSymbolForBinance(symbol: string): string {
  const compact = symbol.replace(/[^a-zA-Z]/g, '').toUpperCase();
  if (compact.endsWith('USDT')) return compact;
  if (compact.endsWith('USD')) return `${compact.slice(0, -3)}USDT`;
  return compact;
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

function computeAtrPercent(
  highs: number[],
  lows: number[],
  closes: number[],
  lookback: number = 14
): number {
  if (highs.length < lookback + 1 || lows.length < lookback + 1 || closes.length < lookback + 1) {
    return 0;
  }

  const start = highs.length - lookback;
  let trSum = 0;

  for (let i = start; i < highs.length; i++) {
    const prevClose = closes[i - 1] ?? closes[i];
    const high = highs[i];
    const low = lows[i];
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trSum += tr;
  }

  const atr = trSum / lookback;
  const latestClose = closes[closes.length - 1] || 0;
  if (latestClose <= 0) return 0;

  return Number(((atr / latestClose) * 100).toFixed(2));
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
  const highs = rows.map((row) => Number(row[2]));
  const lows = rows.map((row) => Number(row[3]));
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
  const volatilityPct = computeAtrPercent(highs, lows, closes, 14);

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
    volatilityPct,
    marketDataSource: 'Binance',
    fetchedAt: Date.now(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const searchParams = request.nextUrl.searchParams;
    const limitParam = Number(searchParams.get('limit') || '5');
    const normalizedLimit = Math.max(1, Math.min(Number.isFinite(limitParam) ? limitParam : 5, 10));

    const candidates = DEFAULT_SYMBOLS.flatMap((symbol) =>
      DEFAULT_TIMEFRAMES.map((timeframe) => ({ symbol, timeframe }))
    );

    const researchCache = new Map<string, Awaited<ReturnType<typeof fetchTradingResearch>>>();

    const getResearch = async (symbol: string) => {
      if (researchCache.has(symbol)) {
        return researchCache.get(symbol)!;
      }

      const research = await fetchTradingResearch(symbol);
      researchCache.set(symbol, research);
      return research;
    };

    const candidateEvaluations = await Promise.all(
      candidates.map(async ({ symbol, timeframe }) => {
        try {
          const research = await getResearch(symbol);
          const marketData = await fetchRealtimeCryptoMarketData(symbol, timeframe);

          const strictOpinion = await computeOpinion(symbol, timeframe, marketData, research);
          const relaxedOpinion = await computeOpinion(symbol, timeframe, marketData, null);

          return {
            symbol,
            timeframe,
            research,
            strictOpinion,
            relaxedOpinion,
          };
        } catch {
          const relaxedOpinion = await computeOpinion(symbol, timeframe, undefined, null);
          return {
            symbol,
            timeframe,
            research: null,
            strictOpinion: relaxedOpinion,
            relaxedOpinion,
          };
        }
      })
    );

    const now = Date.now();

    const buildActionable = (
      opinions: Array<{ opinion: Awaited<ReturnType<typeof computeOpinion>>; research: Awaited<ReturnType<typeof fetchTradingResearch>> | null }>,
      analysisMode: 'news_aligned' | 'technical_with_news_context'
    ) =>
      opinions
      .filter(
        ({ opinion }) =>
          opinion.action !== 'Hold' &&
          typeof opinion.entry === 'number' &&
          typeof opinion.stopLoss === 'number' &&
          typeof opinion.takeProfit === 'number' &&
          opinion.confidence > 0 &&
          now - opinion.fetchedAt <= LIVE_FRESHNESS_MS
      )
      .map(({ opinion, research }) => {
        const entry = opinion.entry as number;
        const stopLoss = opinion.stopLoss as number;
        const takeProfit = opinion.takeProfit as number;

        const estimatedProfitPerUnit = opinion.action === 'Buy'
          ? takeProfit - entry
          : entry - takeProfit;

        const estimatedRiskPerUnit = opinion.action === 'Buy'
          ? entry - stopLoss
          : stopLoss - entry;

        const estimatedProfitPct = entry > 0 ? (estimatedProfitPerUnit / entry) * 100 : 0;
        const estimatedRiskPct = entry > 0 ? (estimatedRiskPerUnit / entry) * 100 : 0;

        const researchSourceCount =
          opinion.researchSources?.length || research?.sources?.length || 0;
        const researchBias = opinion.researchBias || research?.bias || 'neutral';
        const newsStrength = Math.min(1, Math.max(0, researchSourceCount / 3));
        const nextOutcomeConfidence = Number(
          Math.min(0.95, Math.max(0.2, opinion.confidence * 0.75 + newsStrength * 0.2)).toFixed(2)
        );
        const nextOutcome = opinion.action === 'Buy' ? 'bullish' : 'bearish';

        const score = estimatedProfitPct * nextOutcomeConfidence * (1 + newsStrength * 0.15);

        return {
          symbol: opinion.symbol,
          timeframe: opinion.timeframe,
          action: opinion.action,
          confidence: opinion.confidence,
          entry,
          stopLoss,
          takeProfit,
          estimatedProfitPerUnit: Number(estimatedProfitPerUnit.toFixed(2)),
          estimatedProfitPct: Number(estimatedProfitPct.toFixed(2)),
          estimatedRiskPerUnit: Number(estimatedRiskPerUnit.toFixed(2)),
          estimatedRiskPct: Number(estimatedRiskPct.toFixed(2)),
          riskReward:
            estimatedRiskPerUnit > 0
              ? Number((estimatedProfitPerUnit / estimatedRiskPerUnit).toFixed(2))
              : 0,
          score: Number(score.toFixed(4)),
          analysisMode,
          nextOutcome,
          nextOutcomeConfidence,
          researchBias,
          researchSourceCount,
          marketDataSource:
            typeof opinion.marketDataSource === 'string'
              ? opinion.marketDataSource
              : 'Live market feed',
          reason: opinion.reason,
          riskNotes: opinion.riskNotes,
          researchSummary: opinion.researchSummary || research?.summary,
          fetchedAt: opinion.fetchedAt,
        };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        return b.riskReward - a.riskReward;
      });

    const strictActionable = buildActionable(
      candidateEvaluations.map((item) => ({
        opinion: item.strictOpinion,
        research: item.research,
      })),
      'news_aligned'
    );

    const actionable =
      strictActionable.length > 0
        ? strictActionable
        : buildActionable(
            candidateEvaluations.map((item) => ({
              opinion: item.relaxedOpinion,
              research: item.research,
            })),
            'technical_with_news_context'
          );

    const topActionable = actionable.slice(0, normalizedLimit);

    if (!topActionable.length) {
      return NextResponse.json({
        ok: true,
        message: 'No live valid trades found right now. Signals are conflicting, weak, or not fresh enough.',
        bestTrades: [],
        evaluatedCandidates: candidates.length,
        generatedAt: Date.now(),
      }, {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      });
    }

    return NextResponse.json({
      ok: true,
      message:
        strictActionable.length > 0
          ? 'Best live profitable trade setups loaded (news-aligned).'
          : 'Best live profitable technical setups loaded with current public-news context.',
      bestTrades: topActionable,
      evaluatedCandidates: candidates.length,
      generatedAt: Date.now(),
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Failed to load best profitable trades:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to load trading insights',
        bestTrades: [],
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  }
}
