import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-error';

type ResolutionKey = '1s' | '15s' | '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w' | '1M' | 'all';

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

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

function parseBinanceRows(rows: Array<[number, string, string, string, string, string, number, string, number, string, string, string]>): Candle[] {
  return rows.map((row) => ({
    time: Math.floor(row[0] / 1000),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
  }));
}

function parseYahooCandles(payload: YahooChartPayload): Candle[] {
  const result = payload?.chart?.result?.[0];
  const timestamps: number[] = result?.timestamp || [];
  const quote = result?.indicators?.quote?.[0] || {};
  const opens: Array<number | null> = quote.open || [];
  const highs: Array<number | null> = quote.high || [];
  const lows: Array<number | null> = quote.low || [];
  const closes: Array<number | null> = quote.close || [];

  return timestamps
    .map((timestamp, index) => ({
      time: timestamp,
      open: opens[index],
      high: highs[index],
      low: lows[index],
      close: closes[index],
    }))
    .filter(
      (candle): candle is Candle =>
        candle.open !== null && candle.high !== null && candle.low !== null && candle.close !== null
    )
    .map((candle) => ({
      time: candle.time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));
}

async function loadFromBinance(symbol: string, resolution: ResolutionKey): Promise<{ candles: Candle[]; sourceLabel: string }> {
  const config = resolutionMap[resolution];
  const url = `https://api.binance.com/api/v3/klines?symbol=${toBinanceSymbol(symbol)}&interval=${config.interval}&limit=${config.limit}`;
  const response = await fetch(url, { cache: 'no-store' });

  if (!response.ok) throw new Error(`Binance market data unavailable for ${symbol}`);
  const rows = (await response.json()) as Array<[number, string, string, string, string, string, number, string, number, string, string, string]>;
  let candles = parseBinanceRows(rows);
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
  const payload = await response.json();
  let candles = parseYahooCandles(payload);
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
        console.warn('[trading][market-data] fallback provider succeeded', {
          symbol,
          resolution,
          source: attempt.sourceLabel,
          failures,
        });
      }

      return data;
    } catch (error) {
      const message =
        'Unknown market data provider error';
      failures.push(`${attempt.sourceLabel}: ${message}`);
      console.warn('[trading][market-data] provider failed', {
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
