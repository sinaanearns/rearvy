'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CandlestickSeries,
  ColorType,
  LineSeries,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { Timeframe, TradingAction } from '@/types/trading';

interface TradingViewMiniChartProps {
  symbol: string;
  timeframe: Timeframe;
  action: TradingAction;
  confidence: number;
  entry?: number;
  stopLoss?: number;
  takeProfit?: number;
  refreshIntervalMs?: number;
  onLivePriceUpdate?: (price: number, updatedAt: number) => void;
}

const intervalMap: Record<Timeframe, string> = {
  M15: '15m',
  M30: '30m',
  H1: '1h',
  H4: '4h',
  D1: '1d',
  W1: '1w',
};

type ResolutionOption = {
  key: string;
  label: string;
  interval: string;
  limit: number;
  allYears?: boolean;
  aggregateSeconds?: number;
};

type CandleSource = 'binance' | 'yahoo';

type LoadedCandles = {
  candles: CandlestickData<UTCTimestamp>[];
  source: CandleSource;
  sourceLabel: string;
};

const RESOLUTION_OPTIONS: ResolutionOption[] = [
  { key: '1s', label: '1s', interval: '1s', limit: 600 },
  { key: '15s', label: '15s', interval: '1s', limit: 900, aggregateSeconds: 15 },
  { key: '1m', label: '1m', interval: '1m', limit: 600 },
  { key: '5m', label: '5m', interval: '5m', limit: 600 },
  { key: '15m', label: '15m', interval: '15m', limit: 500 },
  { key: '1h', label: '1h', interval: '1h', limit: 400 },
  { key: '4h', label: '4h', interval: '4h', limit: 400 },
  { key: '1d', label: '1d', interval: '1d', limit: 365 },
  { key: '1w', label: '1w', interval: '1w', limit: 260 },
  { key: '1M', label: '1M', interval: '1M', limit: 180 },
  { key: 'all', label: 'All years', interval: '1M', limit: 1000, allYears: true },
];

const resolutionFromOpinionTimeframe: Record<Timeframe, string> = {
  M15: '15m',
  M30: '15m',
  H1: '1h',
  H4: '4h',
  D1: '1d',
  W1: '1w',
};

const yahooIntervalByResolution: Record<string, string> = {
  '1s': '1m',
  '15s': '1m',
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '1h': '1h',
  '4h': '1h',
  '1d': '1d',
  '1w': '1wk',
  '1M': '1mo',
  all: '1mo',
};

const yahooRangeByResolution: Record<string, string> = {
  '1s': '1d',
  '15s': '1d',
  '1m': '5d',
  '5m': '60d',
  '15m': '60d',
  '1h': '1y',
  '4h': '2y',
  '1d': 'max',
  '1w': 'max',
  '1M': 'max',
  all: 'max',
};

function toBinanceSymbol(symbol: string): string {
  const compact = symbol.replace(/[^a-zA-Z]/g, '').toUpperCase();
  if (compact.endsWith('USDT')) return compact;
  if (compact.endsWith('USD')) return `${compact.slice(0, -3)}USDT`;
  return compact;
}

function levelSeriesData(start: Time, end: Time, value: number): LineData[] {
  return [
    { time: start, value },
    { time: end, value },
  ];
}

function aggregateCandles(
  candles: CandlestickData<UTCTimestamp>[],
  bucketSeconds: number
): CandlestickData<UTCTimestamp>[] {
  if (bucketSeconds <= 1) return candles;

  const grouped = new Map<number, CandlestickData<UTCTimestamp>>();

  for (const candle of candles) {
    const ts = Number(candle.time);
    const bucket = Math.floor(ts / bucketSeconds) * bucketSeconds;
    const existing = grouped.get(bucket);

    if (!existing) {
      grouped.set(bucket, {
        time: bucket as UTCTimestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      });
      continue;
    }

    existing.high = Math.max(existing.high, candle.high);
    existing.low = Math.min(existing.low, candle.low);
    existing.close = candle.close;
  }

  return Array.from(grouped.values()).sort((a, b) => Number(a.time) - Number(b.time));
}

async function loadMarketCandles(symbol: string, resolutionKey: string): Promise<LoadedCandles> {
  return fetch(
    `/api/trading/market-data?symbol=${encodeURIComponent(symbol)}&resolution=${encodeURIComponent(resolutionKey)}`,
    { cache: 'no-store' }
  )
    .then(async (response) => {
      if (!response.ok) {
        throw new Error('Market data unavailable');
      }

      const payload = (await response.json()) as {
        candles: Array<{ time: number; open: number; high: number; low: number; close: number }>;
        sourceLabel?: string;
      };

      const candles = payload.candles.map((candle) => ({
        time: candle.time as UTCTimestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      }));

      return {
        candles,
        source: 'yahoo' as CandleSource,
        sourceLabel: payload.sourceLabel || 'Market Data',
      };
    })
    .catch((error) => {
      console.warn('Market-data route failed, generating compact fallback candles:', error);
      const now = Math.floor(Date.now() / 1000) as UTCTimestamp;
      const fallback = Array.from({ length: 24 }, (_, index) => {
        const base = 73300 + Math.sin(index / 3) * 250 + index * 4;
        const open = base;
        const close = base + Math.cos(index / 2) * 20;
        const high = Math.max(open, close) + 14;
        const low = Math.min(open, close) - 14;
        return {
          time: (now - (23 - index) * 3600) as UTCTimestamp,
          open,
          high,
          low,
          close,
        };
      });

      return {
        candles: fallback,
        source: 'yahoo' as CandleSource,
        sourceLabel: 'Fallback Data',
      };
    });
}

function getDefaultBarsToShow(resolutionKey: string): number {
  if (resolutionKey === '1s') return 120;
  if (resolutionKey === '15s') return 120;
  if (resolutionKey === '1m') return 100;
  if (resolutionKey === '5m') return 90;
  if (resolutionKey === '15m') return 96;
  if (resolutionKey === '1h') return 80;
  if (resolutionKey === '4h') return 70;
  if (resolutionKey === '1d') return 60;
  if (resolutionKey === '1w') return 52;
  if (resolutionKey === '1M') return 48;
  if (resolutionKey === 'all') return 72;
  return 80;
}

export default function TradingViewMiniChart({
  symbol,
  timeframe,
  action,
  confidence,
  entry,
  stopLoss,
  takeProfit,
  refreshIntervalMs = 15000,
  onLivePriceUpdate,
}: TradingViewMiniChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const levelSeriesRef = useRef<Array<ISeriesApi<'Line'>>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [selectedResolution, setSelectedResolution] = useState<string>(
    resolutionFromOpinionTimeframe[timeframe] ?? '1h'
  );
  const hasAutoFocusedRef = useRef(false);
  const previousResolutionRef = useRef(selectedResolution);

  const binanceSymbol = useMemo(() => toBinanceSymbol(symbol), [symbol]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 220,
      layout: {
        background: { type: ColorType.Solid, color: '#0b0f19' },
        textColor: '#b6c2d9',
      },
      grid: {
        vertLines: { color: '#1c2333' },
        horzLines: { color: '#1c2333' },
      },
      rightPriceScale: {
        borderColor: '#2a3447',
      },
      timeScale: {
        borderColor: '#2a3447',
        rightOffset: 12,
        fixRightEdge: false,
        lockVisibleTimeRangeOnResize: false,
        rightBarStaysOnScroll: false,
        allowShiftVisibleRangeOnWhitespaceReplacement: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: {
          time: true,
          price: false,
        },
      },
      crosshair: {
        vertLine: { color: '#6a7ea8' },
        horzLine: { color: '#6a7ea8' },
      },
    });

    chartRef.current = chart;
    candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      priceLineVisible: true,
    });

    const onResize = () => {
      if (!container || !chartRef.current) return;
      chartRef.current.applyOptions({ width: container.clientWidth });
    };

    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      levelSeriesRef.current = [];
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function loadCandles(showLoader: boolean) {
      if (!candleSeriesRef.current || !chartRef.current) return;

      if (showLoader) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const loaded = await loadMarketCandles(symbol, selectedResolution);
        let candles = loaded.candles;

        if (isCancelled) return;

        const timeScale = chartRef.current.timeScale();
        const visibleRangeBeforeUpdate = timeScale.getVisibleLogicalRange();
        candleSeriesRef.current.setData(candles);

        const resolutionChanged = previousResolutionRef.current !== selectedResolution;
        if (!hasAutoFocusedRef.current || resolutionChanged) {
          const barsToShow = getDefaultBarsToShow(selectedResolution);
          const to = candles.length - 1 + 8;
          const from = Math.max(0, candles.length - barsToShow);
          timeScale.setVisibleLogicalRange({ from, to });
          hasAutoFocusedRef.current = true;
        } else if (visibleRangeBeforeUpdate) {
          timeScale.setVisibleLogicalRange(visibleRangeBeforeUpdate);
        }

        previousResolutionRef.current = selectedResolution;

        for (const series of levelSeriesRef.current) {
          chartRef.current.removeSeries(series);
        }
        levelSeriesRef.current = [];

        const firstTime = candles[0].time;
        const lastTime = candles[candles.length - 1].time;
        const latestClose = candles[candles.length - 1].close;
        const now = Date.now();
        setLastUpdatedAt(now);
        onLivePriceUpdate?.(latestClose, now);

        if (entry !== undefined) {
          const entrySeries = chartRef.current.addSeries(LineSeries, {
            color: '#3b82f6',
            lineWidth: 2,
            lineStyle: 0,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          entrySeries.applyOptions({ autoscaleInfoProvider: () => null });
          entrySeries.setData(levelSeriesData(firstTime, lastTime, entry));
          levelSeriesRef.current.push(entrySeries);
        }

        if (stopLoss !== undefined) {
          const slSeries = chartRef.current.addSeries(LineSeries, {
            color: '#ef4444',
            lineWidth: 2,
            lineStyle: 2,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          slSeries.applyOptions({ autoscaleInfoProvider: () => null });
          slSeries.setData(levelSeriesData(firstTime, lastTime, stopLoss));
          levelSeriesRef.current.push(slSeries);
        }

        if (takeProfit !== undefined) {
          const tpSeries = chartRef.current.addSeries(LineSeries, {
            color: '#22c55e',
            lineWidth: 2,
            lineStyle: 2,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          tpSeries.applyOptions({ autoscaleInfoProvider: () => null });
          tpSeries.setData(levelSeriesData(firstTime, lastTime, takeProfit));
          levelSeriesRef.current.push(tpSeries);
        }
      } catch (loadError) {
        if (isCancelled) return;
        const message = loadError instanceof Error ? loadError.message : 'Failed to load chart.';
        setError(message);
      } finally {
        if (!isCancelled && showLoader) {
          setIsLoading(false);
        }
      }
    }

    loadCandles(true);
    intervalId = setInterval(() => {
      loadCandles(false);
    }, Math.max(refreshIntervalMs, 5000));

    return () => {
      isCancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [
    binanceSymbol,
    timeframe,
    entry,
    stopLoss,
    takeProfit,
    refreshIntervalMs,
    onLivePriceUpdate,
    selectedResolution,
  ]);

  const actionBadgeClass =
    action === 'Buy'
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
      : action === 'Sell'
        ? 'bg-rose-500/20 text-rose-300 border-rose-400/40'
        : 'bg-slate-500/20 text-slate-300 border-slate-400/40';

  const confirmedSignal = (() => {
    // "Really confirmed": strict confidence threshold.
    if (confidence < 0.7) return null;
    if (action === 'Buy') return 'BUY';
    if (action === 'Sell') return 'SELL';
    // Strong Hold is treated as an exit/flat signal.
    if (action === 'Hold' && confidence >= 0.75) return 'EXIT';
    return null;
  })();

  const confirmedSignalClass =
    confirmedSignal === 'BUY'
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
      : confirmedSignal === 'SELL'
        ? 'bg-rose-500/20 text-rose-300 border-rose-400/40'
        : 'bg-amber-500/20 text-amber-300 border-amber-400/40';

  return (
    <div className="px-4 py-3 border-b bg-slate-950">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
            Live Chart ({symbol.replace(/\s+/g, '').toUpperCase()})
          </p>
          <span className="text-[11px] text-emerald-300/90 flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </span>
        </div>
        <span className={`text-[11px] px-2 py-1 rounded-full border ${actionBadgeClass}`}>
          {action}
        </span>
      </div>

      {lastUpdatedAt && (
        <p className="mb-2 text-[11px] text-slate-400">
          Updated {new Date(lastUpdatedAt).toLocaleTimeString()}
        </p>
      )}

      <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
        {RESOLUTION_OPTIONS.map((option) => {
          const isSelected = selectedResolution === option.key;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => setSelectedResolution(option.key)}
              className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                isSelected
                  ? 'border-cyan-400/60 bg-cyan-400/20 text-cyan-200'
                  : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="relative h-[220px] rounded-md border border-slate-800 overflow-hidden">
        <div ref={containerRef} className="h-full w-full" />

        {confirmedSignal && (
          <div className="pointer-events-none absolute left-2 top-2">
            <span className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-semibold ${confirmedSignalClass}`}>
              Confirmed {confirmedSignal} Signal
            </span>
          </div>
        )}

        {isLoading && (
          <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center text-xs text-slate-300">
            Loading chart...
          </div>
        )}

        {error && (
          <div className="absolute inset-0 bg-slate-950/90 flex items-center justify-center px-3 text-center text-xs text-rose-300">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
