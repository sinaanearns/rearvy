'use client';

import { useEffect, useRef, useState } from 'react';
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

type ResolutionOption = {
  key: string;
  label: string;
  interval: string;
  limit: number;
  allYears?: boolean;
  aggregateSeconds?: number;
};

type LoadedCandles = {
  candles: CandlestickData<UTCTimestamp>[];
};

type MarketCandlePayload = {
  candles?: unknown;
};

type MarketCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
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

function levelSeriesData(start: Time, end: Time, value: number): LineData[] {
  return [
    { time: start, value },
    { time: end, value },
  ];
}

async function loadMarketCandles(symbol: string, resolutionKey: string): Promise<LoadedCandles> {
  const response = await fetch(
    `/api/trading/market-data?symbol=${encodeURIComponent(symbol)}&resolution=${encodeURIComponent(resolutionKey)}`,
    { cache: 'no-store' }
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(payload?.error || 'Market data unavailable');
  }

  const payload = (await response.json().catch(() => null)) as
    | MarketCandlePayload
    | null;
  if (!Array.isArray(payload?.candles)) {
    throw new Error('Market data response did not include candles');
  }

  const candles = payload.candles.flatMap(
    (candle): CandlestickData<UTCTimestamp>[] => {
      if (!isMarketCandle(candle)) {
        return [];
      }
      return [
        {
          time: candle.time as UTCTimestamp,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
        },
      ];
    }
  );

  if (candles.length === 0) {
    throw new Error('Market data response did not include valid candles');
  }

  return { candles };
}

function isMarketCandle(value: unknown): value is MarketCandle {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candle = value as Record<string, unknown>;
  return (
    typeof candle.time === 'number' &&
    typeof candle.open === 'number' &&
    typeof candle.high === 'number' &&
    typeof candle.low === 'number' &&
    typeof candle.close === 'number'
  );
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

  useEffect(() => {
    const defaultResolution = resolutionFromOpinionTimeframe[timeframe] ?? '1h';
    hasAutoFocusedRef.current = false;
    previousResolutionRef.current = defaultResolution;
    setSelectedResolution(defaultResolution);
  }, [symbol, timeframe]);

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
        const candles = loaded.candles;

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
    symbol,
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
    <div className="border-b bg-slate-950 px-4 py-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <p className="truncate text-sm font-semibold text-slate-300">
            Live Chart ({symbol.replace(/\s+/g, '').toUpperCase()})
          </p>
          <span className="flex shrink-0 items-center gap-1 text-[11px] text-emerald-300/90">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </span>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] ${actionBadgeClass}`}>
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

      <div className="relative h-[220px] overflow-hidden rounded-[8px] border border-slate-800 bg-slate-950">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:100%_44px,72px_100%]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-8 bottom-12 top-10 rounded-[8px] bg-[linear-gradient(120deg,transparent_0_12%,rgba(34,197,94,0.1)_12%_30%,transparent_30%_42%,rgba(14,165,233,0.12)_42%_58%,transparent_58%_72%,rgba(16,185,129,0.13)_72%_100%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute left-[9%] right-[9%] top-[46%] h-px bg-gradient-to-r from-transparent via-cyan-300/35 to-transparent"
        />
        <div ref={containerRef} className="relative z-10 h-full w-full" />

        {confirmedSignal && (
          <div className="pointer-events-none absolute left-2 top-2">
            <span className={`inline-flex items-center rounded-[8px] border px-2 py-1 text-[11px] font-semibold ${confirmedSignalClass}`}>
              Confirmed {confirmedSignal.toLowerCase()} signal
            </span>
          </div>
        )}

        {isLoading && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/45 text-xs text-slate-300 backdrop-blur-[1px]">
            <span className="rounded-[8px] border border-slate-700 bg-slate-950/80 px-3 py-1.5 shadow-sm shadow-slate-950/30">
              Loading market candles...
            </span>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/90 px-3 text-center text-xs text-rose-300">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
