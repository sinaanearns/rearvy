import type { Timeframe } from "@/types/trading";
import type { MarketData } from "@/lib/trading/opinion-engine";
import { createServerLogger } from "@/lib/server-logger";

export type MarketCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

type TimeframeFetchConfig = {
  binanceInterval: string;
  yahooInterval: string;
  yahooRange: string;
  yahooAggregateSeconds?: number;
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

const log = createServerLogger("TradingMarketData");

function getFetchConfig(timeframe: Timeframe): TimeframeFetchConfig {
  const config = FETCH_CONFIG[timeframe];
  if (!config) {
    throw new Error(
      `Unsupported timeframe: ${String(timeframe)}. Allowed values: ${Object.keys(FETCH_CONFIG).join(", ")}`
    );
  }

  return config;
}

function shouldLogTradingDiagnostics(): boolean {
  return process.env.REARVY_TRADING_DEBUG === "1";
}

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

    if (isCryptoMarketSymbol(symbol) && !isForexOrMetalSymbol(symbol)) {
      return `${base}-${quote === "USDT" ? "USD" : quote}`;
    }

    return `${base}${quote}=X`;
  }

  if (compact.endsWith("=X") || compact.includes("-")) return compact;

  const normalizedQuoteSymbol = compact.replace(/USDT$/, "USD");
  const cryptoPairMatch = normalizedQuoteSymbol.match(
    /^([A-Z0-9]+?)(USD|EUR|GBP|JPY)$/
  );

  if (cryptoPairMatch && isCryptoMarketSymbol(cryptoPairMatch[1])) {
    return `${cryptoPairMatch[1]}-${cryptoPairMatch[2]}`;
  }

  if (isCryptoMarketSymbol(normalizedQuoteSymbol)) {
    return `${normalizedQuoteSymbol}-USD`;
  }

  if (/^(XAU|XAG|EUR|GBP|JPY|CHF|CAD|AUD|NZD)/.test(compact)) {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseFiniteNumber(value: unknown): number | null {
  const nextValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(nextValue) ? nextValue : null;
}

function isBinanceKlineRow(value: unknown): value is BinanceKlineRow {
  return (
    Array.isArray(value) &&
    value.length >= 6 &&
    isFiniteNumber(value[0]) &&
    typeof value[1] === "string" &&
    typeof value[2] === "string" &&
    typeof value[3] === "string" &&
    typeof value[4] === "string" &&
    typeof value[5] === "string"
  );
}

function parseBinanceRows(payload: unknown): MarketCandle[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((row): MarketCandle | null => {
      if (!isBinanceKlineRow(row)) {
        return null;
      }

      const open = parseFiniteNumber(row[1]);
      const high = parseFiniteNumber(row[2]);
      const low = parseFiniteNumber(row[3]);
      const close = parseFiniteNumber(row[4]);
      const volume = parseFiniteNumber(row[5]);

      return open !== null &&
        high !== null &&
        low !== null &&
        close !== null &&
        volume !== null
        ? {
            time: Math.floor(row[0] / 1000),
            open,
            high,
            low,
            close,
            volume,
          }
        : null;
    })
    .filter((candle): candle is MarketCandle => Boolean(candle));
}

function parseYahooCandles(payload: unknown): MarketCandle[] {
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
  const volumes = Array.isArray(quote.volume) ? quote.volume : [];

  return timestamps
    .map((timestamp, index): MarketCandle | null => {
      const time = parseFiniteNumber(timestamp);
      const open = parseFiniteNumber(opens[index]);
      const high = parseFiniteNumber(highs[index]);
      const low = parseFiniteNumber(lows[index]);
      const close = parseFiniteNumber(closes[index]);
      const volume = parseFiniteNumber(volumes[index]);

      return time !== null && open !== null && high !== null && low !== null && close !== null
        ? {
            time,
            open,
            high,
            low,
            close,
            ...(volume !== null ? { volume } : {}),
          }
        : null;
    })
    .filter((candle): candle is MarketCandle => Boolean(candle));
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
  const config = getFetchConfig(timeframe);
  const response = await fetch(
    `https://api.binance.com/api/v3/klines?symbol=${toBinanceSymbol(
      symbol
    )}&interval=${config.binanceInterval}&limit=160`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error(`Binance market data unavailable for ${symbol}`);
  }

  const candles = parseBinanceRows(await readJson(response));
  if (candles.length === 0) {
    throw new Error(`Binance returned no candles for ${symbol}`);
  }

  return candles;
}

async function fetchYahooCandles(
  symbol: string,
  timeframe: Timeframe
): Promise<MarketCandle[]> {
  const config = getFetchConfig(timeframe);
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

  const candles = parseYahooCandles(await readJson(response));

  if (candles.length === 0) {
    throw new Error(`Yahoo Finance returned no candles for ${symbol}`);
  }

  return config.yahooAggregateSeconds
    ? aggregateCandlesBySeconds(candles, config.yahooAggregateSeconds)
    : candles;
}

export async function fetchMarketCandlesForTimeframe(
  symbol: string,
  timeframe: Timeframe
): Promise<{ candles: MarketCandle[]; sourceLabel: string }> {
  const normalizedSymbol = normalizeTradingSymbol(symbol);
  const attempts =
    isCryptoMarketSymbol(normalizedSymbol) &&
    !isForexOrMetalSymbol(normalizedSymbol)
      ? [
          {
            sourceLabel: "Binance",
            loader: () => fetchBinanceCandles(normalizedSymbol, timeframe),
          },
          {
            sourceLabel: "Yahoo Finance",
            loader: () => fetchYahooCandles(normalizedSymbol, timeframe),
          },
        ]
      : [
          {
            sourceLabel: "Yahoo Finance",
            loader: () => fetchYahooCandles(normalizedSymbol, timeframe),
          },
        ];

  const failures: string[] = [];

  for (const attempt of attempts) {
    try {
      const candles = await attempt.loader();

      if (failures.length > 0) {
        log.warn("fallback provider succeeded", {
          symbol: normalizedSymbol,
          timeframe,
          source: attempt.sourceLabel,
          failures,
        });
      }

      return {
        candles,
        sourceLabel: attempt.sourceLabel,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown market data provider error";

      failures.push(`${attempt.sourceLabel}: ${message}`);
      log.warn("provider failed", {
        symbol: normalizedSymbol,
        timeframe,
        source: attempt.sourceLabel,
        error: message,
      });
    }
  }

  throw new Error(
    failures.join(" | ") || `Failed to load market data for ${normalizedSymbol}`
  );
}

export function buildMarketDataFromCandles(
  symbol: string,
  candles: MarketCandle[],
  sourceLabel: string,
  timeframe?: Timeframe
): MarketData & { marketDataSource: string } {
  if (candles.length === 0) {
    throw new Error(`No market candles returned for ${symbol}`);
  }

  const closes = candles.map((candle) => candle.close);
  const highs = candles.map((candle) => candle.high);
  const lows = candles.map((candle) => candle.low);
  const volumes = candles.map((candle) => candle.volume ?? 0);
  const latest = candles[candles.length - 1];
  const macd = computeMACD(closes);
  const rsi = computeRSI(closes, 14);
  const ema20Series = computeEMA(closes, 20);
  const ema50Series = computeEMA(closes, 50);
  const ema20 = ema20Series.length ? ema20Series[ema20Series.length - 1] : undefined;
  const ema50 = ema50Series.length ? ema50Series[ema50Series.length - 1] : undefined;

  const momentumLookback = Math.min(12, Math.max(1, closes.length - 1));
  const momentumBase = closes[Math.max(0, closes.length - 1 - momentumLookback)] ?? latest.close;
  const momentumPct =
    momentumBase > 0
      ? Number((((latest.close - momentumBase) / momentumBase) * 100).toFixed(2))
      : 0;

  const structureWindow = Math.min(20, highs.length - 1);
  const recentHigh =
    structureWindow > 0
      ? Math.max(...highs.slice(highs.length - 1 - structureWindow, highs.length - 1))
      : latest.high;
  const recentLow =
    structureWindow > 0
      ? Math.min(...lows.slice(lows.length - 1 - structureWindow, lows.length - 1))
      : latest.low;
  const priorClose = closes.length > 1 ? closes[closes.length - 2] : latest.close;

  const breakoutAboveRecentHigh = latest.close > recentHigh;
  const breakdownBelowRecentLow = latest.close < recentLow;

  const volumeWindow = Math.min(20, volumes.length);
  const avgVolume = volumeWindow > 0
    ? volumes.slice(volumes.length - volumeWindow).reduce((sum, value) => sum + value, 0) / volumeWindow
    : 0;
  const volumeRatio = avgVolume > 0 ? Number((latest.volume ? latest.volume / avgVolume : 0).toFixed(2)) : 0;

  if (shouldLogTradingDiagnostics()) {
    log.debug("indicators", {
      symbol,
      timeframe,
      source: sourceLabel,
      candleCount: candles.length,
      rsi,
      macd,
      ema20,
      ema50,
      momentumPct,
      fetchedAt: Date.now(),
    });
  }

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
    ema20,
    ema50,
    momentumPct,
    breakoutAboveRecentHigh,
    breakdownBelowRecentLow,
    volumeRatio,
    recentHigh,
    recentLow,
    priorClose,
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

  return buildMarketDataFromCandles(symbol, candles, sourceLabel, timeframe);
}
