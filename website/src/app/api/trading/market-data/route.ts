import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-error';
import { createServerLogger } from '@/lib/server-logger';

type ResolutionKey = '1s' | '15s' | '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w' | '1M' | 'all';

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

type BinanceKlineRow = [
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
];

type YahooChartPayload = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
        }>;
      };
    }>;
  };
};

const log = createServerLogger('TradingMarketDataRoute');

const resolutionMap: Record<ResolutionKey, { interval: string; limit: number; aggregateSeconds?: number; range?: string }> = {
  '1s': { interval: '1m', limit: 600 },
  '15s': { interval: '1m', limit: 900, aggregateSeconds: 15 },
  '1m': { interval: '1m', limit: 600 },
  '5m': { interval: '5m', limit: 600 },
  '15m': { interval: '15m', limit: 500 },
  '1h': { interval: '1h', limit: 400 },
  '4h': { interval: '1h', limit: 800, aggregateSeconds: 4 * 60 * 60 },
  '1d': { interval: '1d', limit: 365 },
  '1w': { interval: '1w', limit: 260 },
  '1M': { interval: '1M', limit: 180 },
  all: { interval: '1M', limit: 1000, range: 'max' },
};

function normalizeResolution(raw: string | null): ResolutionKey {
  const value = (raw || '1d').trim();
  const aliases: Record<string, ResolutionKey> = {
    '1s': '1s',
    '15s': '15s',
    '1m': '1m',
    '5m': '5m',
    '15m': '15m',
    '1h': '1h',
    '4h': '4h',
    '1d': '1d',
    '1w': '1w',
    '1M': '1M',
    all: 'all',
  };

  return aliases[value] ?? '1d';
}

function normalizeSymbol(symbol: string): string {
  return symbol.replace(/\s+/g, '').toUpperCase();
}

function toBinanceSymbol(symbol: string): string {
  const compact = symbol.replace(/[^a-zA-Z]/g, '').toUpperCase();
  if (compact.endsWith('USDT')) return compact;
  if (compact.endsWith('USD')) return `${compact.slice(0, -3)}USDT`;
  return compact;
}

function toYahooSymbol(symbol: string): string {
  const compact = symbol.replace(/\s+/g, '').toUpperCase();
  if (compact.includes('/')) {
    const [base, quote] = compact.split('/');
    if (!base || !quote) return compact;

    if (isCrypto(symbol) && !isForexOrMetal(symbol)) {
      return `${base}-${quote === 'USDT' ? 'USD' : quote}`;
    }

    return `${base}${quote}=X`;
  }

  if (compact.endsWith('=X') || compact.includes('-')) return compact;

  const normalizedQuoteSymbol = compact.replace(/USDT$/, 'USD');
  const cryptoPairMatch = normalizedQuoteSymbol.match(/^([A-Z0-9]+?)(USD|EUR|GBP|JPY)$/);

  if (cryptoPairMatch && isCrypto(cryptoPairMatch[1])) {
    return `${cryptoPairMatch[1]}-${cryptoPairMatch[2]}`;
  }

  if (isCrypto(normalizedQuoteSymbol)) {
    return `${normalizedQuoteSymbol}-USD`;
  }

  if (/^(XAU|XAG|EUR|GBP|JPY|CHF|CAD|AUD|NZD)/.test(compact)) {
    return compact.includes('USD') ? `${compact}=X` : `${compact}USD=X`;
  }

  return compact;
}

function isCrypto(symbol: string): boolean {
  return /(BTC|ETH|SOL|XRP|ADA|DOGE|BNB|LTC|AVAX|DOT|MATIC|USDT)/i.test(symbol);
}

function isForexOrMetal(symbol: string): boolean {
  return /(XAU|XAG|EUR|GBP|JPY|CHF|CAD|AUD|NZD)\/?USD|USD\/?(JPY|CHF|CAD|AUD|NZD|TRY|MXN)/i.test(symbol);
}

function aggregateCandles(candles: Candle[], bucketSeconds: number): Candle[] {
  if (bucketSeconds <= 1) return candles;

  const grouped = new Map<number, Candle>();
  for (const candle of candles) {
    const bucket = Math.floor(candle.time / bucketSeconds) * bucketSeconds;
    const existing = grouped.get(bucket);
    if (!existing) {
      grouped.set(bucket, { ...candle, time: bucket });
      continue;
    }
    existing.high = Math.max(existing.high, candle.high);
    existing.low = Math.min(existing.low, candle.low);
    existing.close = candle.close;
  }

  return [...grouped.values()].sort((a, b) => a.time - b.time);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseFiniteNumber(value: unknown): number | null {
  const nextValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(nextValue) ? nextValue : null;
}

function isBinanceKlineRow(value: unknown): value is BinanceKlineRow {
  return (
    Array.isArray(value) &&
    value.length >= 5 &&
    isFiniteNumber(value[0]) &&
    typeof value[1] === 'string' &&
    typeof value[2] === 'string' &&
    typeof value[3] === 'string' &&
    typeof value[4] === 'string'
  );
}

function parseBinanceRows(payload: unknown): Candle[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((row): Candle | null => {
      if (!isBinanceKlineRow(row)) {
        return null;
      }

      const open = parseFiniteNumber(row[1]);
      const high = parseFiniteNumber(row[2]);
      const low = parseFiniteNumber(row[3]);
      const close = parseFiniteNumber(row[4]);

      return open !== null && high !== null && low !== null && close !== null
        ? {
            time: Math.floor(row[0] / 1000),
            open,
            high,
            low,
            close,
          }
        : null;
    })
    .filter((candle): candle is Candle => Boolean(candle));
}

function parseYahooCandles(payload: unknown): Candle[] {
  if (!isRecord(payload) || !isRecord(payload.chart) || !Array.isArray(payload.chart.result)) {
    return [];
  }

  const result = payload.chart.result.find(isRecord);
  const indicators = isRecord(result?.indicators) ? result.indicators : null;
  const quotes = Array.isArray(indicators?.quote) ? indicators.quote : [];
  const quote = quotes.find(isRecord) ?? {};
  const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : [];
  const opens = Array.isArray(quote.open) ? quote.open : [];
  const highs = Array.isArray(quote.high) ? quote.high : [];
  const lows = Array.isArray(quote.low) ? quote.low : [];
  const closes = Array.isArray(quote.close) ? quote.close : [];

  return timestamps
    .map((timestamp, index): Candle | null => {
      const time = parseFiniteNumber(timestamp);
      const open = parseFiniteNumber(opens[index]);
      const high = parseFiniteNumber(highs[index]);
      const low = parseFiniteNumber(lows[index]);
      const close = parseFiniteNumber(closes[index]);

      return time !== null && open !== null && high !== null && low !== null && close !== null
        ? { time, open, high, low, close }
        : null;
    })
    .filter((candle): candle is Candle => Boolean(candle));
}

async function loadFromBinance(symbol: string, resolution: ResolutionKey): Promise<{ candles: Candle[]; sourceLabel: string }> {
  const config = resolutionMap[resolution];
  const url = `https://api.binance.com/api/v3/klines?symbol=${toBinanceSymbol(symbol)}&interval=${config.interval}&limit=${config.limit}`;
  const response = await fetch(url, { cache: 'no-store' });

  if (!response.ok) throw new Error(`Binance market data unavailable for ${symbol}`);
  let candles = parseBinanceRows(await readJson(response));
  if (candles.length === 0) throw new Error(`Binance returned no candles for ${symbol}`);
  if (config.aggregateSeconds) candles = aggregateCandles(candles, config.aggregateSeconds);
  return { candles, sourceLabel: 'Binance' };
}

async function loadFromYahoo(symbol: string, resolution: ResolutionKey): Promise<{ candles: Candle[]; sourceLabel: string }> {
  const config = resolutionMap[resolution];
  const yahooSymbol = encodeURIComponent(toYahooSymbol(symbol));
  const range = resolution === 'all' ? 'max' : config.range || '1y';
  const interval = resolution === '1s' || resolution === '15s' ? '1m' : config.interval === '1M' ? '1mo' : config.interval;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?range=${range}&interval=${interval}&includePrePost=true&events=div,splits`;
  const response = await fetch(url, { cache: 'no-store', headers: { 'cache-control': 'no-cache' } });

  if (!response.ok) throw new Error(`Yahoo Finance data unavailable for ${symbol}`);
  let candles = parseYahooCandles(await readJson(response));
  if (candles.length === 0) throw new Error(`Yahoo Finance returned no candles for ${symbol}`);
  if (config.aggregateSeconds) candles = aggregateCandles(candles, config.aggregateSeconds);
  return { candles, sourceLabel: 'Yahoo Finance' };
}

async function loadMarketDataWithFallbacks(
  symbol: string,
  resolution: ResolutionKey
): Promise<{ candles: Candle[]; sourceLabel: string }> {
  const attempts =
    isCrypto(symbol) && !isForexOrMetal(symbol)
      ? [
          { sourceLabel: 'Binance', loader: () => loadFromBinance(symbol, resolution) },
          { sourceLabel: 'Yahoo Finance', loader: () => loadFromYahoo(symbol, resolution) },
        ]
      : [{ sourceLabel: 'Yahoo Finance', loader: () => loadFromYahoo(symbol, resolution) }];

  const failures: string[] = [];

  for (const attempt of attempts) {
    try {
      const data = await attempt.loader();

      if (failures.length > 0) {
        log.warn('fallback provider succeeded', {
          symbol,
          resolution,
          source: attempt.sourceLabel,
          failures,
        });
      }

      return data;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown market data provider error';
      failures.push(`${attempt.sourceLabel}: ${message}`);
      log.warn('provider failed', {
        symbol,
        resolution,
        source: attempt.sourceLabel,
        error: message,
      });
    }
  }

  throw new Error(failures.join(' | ') || `Failed to load market data for ${symbol}`);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');
  const resolution = normalizeResolution(searchParams.get('resolution'));

  if (!symbol) {
    return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });
  }

  const normalizedSymbol = normalizeSymbol(symbol);

  try {
    const data = await loadMarketDataWithFallbacks(normalizedSymbol, resolution);

    return NextResponse.json({
      candles: data.candles,
      sourceLabel: data.sourceLabel,
      symbol: normalizedSymbol,
      resolution,
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/trading/market-data', { symbol: normalizedSymbol, resolution });
  }
}
