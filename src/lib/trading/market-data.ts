import type { Timeframe } from "@/types/trading";
import type { MarketData } from "@/lib/trading/opinion-engine";

export type MarketCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
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
          volume?: Array<number | null>;
        }>;
      };
    }>;
  };
};

type TimeframeFetchConfig = {
  binanceInterval: string;
  yahooInterval: string;
  yahooRange: string;
  yahooAggregateSeconds?: number;
};

const FETCH_CONFIG: Record<Timeframe, TimeframeFetchConfig> = {
  M15: {
    binanceInterval: "15m",
    yahooInterval: "15m",
    yahooRange: "60d",
  },
  M30: {
    binanceInterval: "30m",
    yahooInterval: "30m",
    yahooRange: "60d",
  },
  H1: {
    binanceInterval: "1h",
    yahooInterval: "60m",
    yahooRange: "730d",
  },
  H4: {
    binanceInterval: "4h",
    yahooInterval: "60m",
    yahooRange: "730d",
    yahooAggregateSeconds: 4 * 60 * 60,
  },
  D1: {
    binanceInterval: "1d",
    yahooInterval: "1d",
    yahooRange: "10y",
  },
  W1: {
    binanceInterval: "1w",
    yahooInterval: "1wk",
    yahooRange: "max",
  },
};

function toBinanceSymbol(symbol: string): string {
  const compact = symbol.replace(/[^a-zA-Z]/g, "").toUpperCase();
  if (compact.endsWith("USDT")) return compact;
  if (compact.endsWith("USD")) return `${compact.slice(0, -3)}USDT`;
  return compact;
}

function toYahooSymbol(symbol: string): string {
  const compact = symbol.replace(/\s+/g, "").toUpperCase();

  if (compact.includes("/")) {
    const [base, quote] = compact.split("/");
    if (!base || !quote) return compact;
    return `${base}${quote}=X`;
  }

  if (compact.endsWith("=X")) return compact;

  if (
    /^(XAU|XAG|EUR|GBP|JPY|CHF|CAD|AUD|NZD|BTC|ETH|SOL|XRP|ADA|DOGE|BNB|LTC|AVAX|DOT|MATIC)/.test(
      compact
    )
  ) {
    return compact.includes("USD") ? `${compact}=X` : `${compact}USD=X`;
  }

  return compact;
}

export function normalizeTradingSymbol(symbol: string): string {
  return symbol.replace(/\s+/g, "").toUpperCase();
}

export function isCryptoMarketSymbol(symbol: string): boolean {
  return /(BTC|ETH|SOL|XRP|ADA|DOGE|BNB|LTC|AVAX|DOT|MATIC|USDT)/i.test(symbol);
}

export function isForexOrMetalSymbol(symbol: string): boolean {
  return /(XAU|XAG|EUR|GBP|JPY|CHF|CAD|AUD|NZD)\/?USD|USD\/?(JPY|CHF|CAD|AUD|NZD|TRY|MXN)/i.test(
    symbol
  );
}

function aggregateCandlesBySeconds(
  candles: MarketCandle[],
  bucketSeconds: number
): MarketCandle[] {
  if (bucketSeconds <= 60 || candles.length === 0) {
    return candles;
  }

  const grouped = new Map<number, MarketCandle>();

  for (const candle of candles) {
    const bucket = Math.floor(candle.time / bucketSeconds) * bucketSeconds;
    const existing = grouped.get(bucket);

    if (!existing) {
      grouped.set(bucket, {
        ...candle,
        time: bucket,
      });
      continue;
    }

    existing.high = Math.max(existing.high, candle.high);
    existing.low = Math.min(existing.low, candle.low);
    existing.close = candle.close;
    existing.volume = (existing.volume || 0) + (candle.volume || 0);
  }

  return [...grouped.values()].sort((a, b) => a.time - b.time);
}

function parseBinanceRows(
  rows: Array<
    [
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
    ]
  >
): MarketCandle[] {
  return rows.map((row) => ({
    time: Math.floor(row[0] / 1000),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
  }));
}

function parseYahooCandles(payload: YahooChartPayload): MarketCandle[] {
  type RawYahooCandle = {
    time: number;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
    volume: number | null | undefined;
  };

  const result = payload?.chart?.result?.[0];
  const timestamps = result?.timestamp || [];
  const quote = result?.indicators?.quote?.[0] || {};
  const opens = quote.open || [];
  const highs = quote.high || [];
  const lows = quote.low || [];
  const closes = quote.close || [];
  const volumes = quote.volume || [];

  const rawCandles: RawYahooCandle[] = timestamps
    .map((timestamp, index) => ({
      time: timestamp,
      open: opens[index],
      high: highs[index],
      low: lows[index],
      close: closes[index],
      volume: volumes[index] ?? undefined,
    }));

  return rawCandles
    .filter(
      (candle): candle is RawYahooCandle & {
        open: number;
        high: number;
        low: number;
        close: number;
      } =>
        candle.open !== null &&
        candle.high !== null &&
        candle.low !== null &&
        candle.close !== null
    )
    .map((candle) => ({
      time: candle.time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume:
        typeof candle.volume === "number" ? candle.volume : undefined,
    }));
}

export function computeEMA(values: number[], period: number): number[] {
  if (values.length === 0) return [];

  const k = 2 / (period + 1);
  const result: number[] = [values[0]];

  for (let index = 1; index < values.length; index += 1) {
    result.push(values[index] * k + result[index - 1] * (1 - k));
  }

  return result;
}

export function computeRSI(
  values: number[],
  period: number = 14
): number | undefined {
  if (values.length <= period) return undefined;

  let gains = 0;
  let losses = 0;

  for (let index = values.length - period; index < values.length; index += 1) {
    const delta = values[index] - values[index - 1];
    if (delta >= 0) gains += delta;
    else losses += Math.abs(delta);
  }

  if (losses === 0) return 100;

  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

export function computeMACD(values: number[]): number | undefined {
  if (values.length < 26) return undefined;

  const ema12 = computeEMA(values, 12);
  const ema26 = computeEMA(values, 26);

  if (!ema12.length || !ema26.length) {
    return undefined;
  }

  return ema12[ema12.length - 1] - ema26[ema26.length - 1];
}

export function computeTrend(values: number[]): "up" | "down" | "sideways" {
  const currentPrice = values[values.length - 1];
  const baseline = values[Math.max(0, values.length - 20)] ?? currentPrice;
  const trendDelta = baseline === 0 ? 0 : (currentPrice - baseline) / baseline;

  if (trendDelta > 0.002) return "up";
  if (trendDelta < -0.002) return "down";
  return "sideways";
}

async function fetchBinanceCandles(
  symbol: string,
  timeframe: Timeframe
): Promise<MarketCandle[]> {
  const config = FETCH_CONFIG[timeframe];
  const response = await fetch(
    `https://api.binance.com/api/v3/klines?symbol=${toBinanceSymbol(
      symbol
    )}&interval=${config.binanceInterval}&limit=160`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error(`Binance market data unavailable for ${symbol}`);
  }

  const rows = (await response.json()) as Array<
    [
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
    ]
  >;

  return parseBinanceRows(rows);
}

async function fetchYahooCandles(
  symbol: string,
  timeframe: Timeframe
): Promise<MarketCandle[]> {
  const config = FETCH_CONFIG[timeframe];
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      toYahooSymbol(symbol)
    )}?range=${config.yahooRange}&interval=${config.yahooInterval}&includePrePost=true&events=div,splits`,
    {
      cache: "no-store",
      headers: { "cache-control": "no-cache" },
    }
  );

  if (!response.ok) {
    throw new Error(`Yahoo Finance data unavailable for ${symbol}`);
  }

  const candles = parseYahooCandles(
    (await response.json()) as YahooChartPayload
  );

  return config.yahooAggregateSeconds
    ? aggregateCandlesBySeconds(candles, config.yahooAggregateSeconds)
    : candles;
}

export async function fetchMarketCandlesForTimeframe(
  symbol: string,
  timeframe: Timeframe
): Promise<{ candles: MarketCandle[]; sourceLabel: string }> {
  const normalizedSymbol = normalizeTradingSymbol(symbol);
  const shouldUseBinance =
    isCryptoMarketSymbol(normalizedSymbol) &&
    !isForexOrMetalSymbol(normalizedSymbol);

  const candles = shouldUseBinance
    ? await fetchBinanceCandles(normalizedSymbol, timeframe)
    : await fetchYahooCandles(normalizedSymbol, timeframe);

  return {
    candles,
    sourceLabel: shouldUseBinance ? "Binance" : "Yahoo Finance",
  };
}

export function buildMarketDataFromCandles(
  symbol: string,
  candles: MarketCandle[],
  sourceLabel: string
): MarketData & { marketDataSource: string } {
  if (candles.length === 0) {
    throw new Error(`No market candles returned for ${symbol}`);
  }

  const closes = candles.map((candle) => candle.close);
  const latest = candles[candles.length - 1];
  const macd = computeMACD(closes);
  const rsi = computeRSI(closes, 14);

  return {
    symbol,
    currentPrice: latest.close,
    open: latest.open,
    high: latest.high,
    low: latest.low,
    close: latest.close,
    volume: latest.volume,
    rsi,
    macd,
    trend: computeTrend(closes),
    fetchedAt: Date.now(),
    marketDataSource: sourceLabel,
  };
}

export async function fetchLiveMarketData(
  symbol: string,
  timeframe: Timeframe
): Promise<MarketData & { marketDataSource: string }> {
  const { candles, sourceLabel } = await fetchMarketCandlesForTimeframe(
    symbol,
    timeframe
  );

  return buildMarketDataFromCandles(symbol, candles, sourceLabel);
}
