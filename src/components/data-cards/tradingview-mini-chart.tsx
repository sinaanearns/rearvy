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

export default function TradingViewMiniChart({
  symbol,
  timeframe,
  action,
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
        const interval = intervalMap[timeframe] ?? '1d';
        const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=200`;
        const response = await fetch(url, { cache: 'no-store' });

        if (!response.ok) {
          throw new Error('Market candles unavailable for this symbol.');
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
          throw new Error('No candle data returned.');
        }

        const candles: CandlestickData[] = rows.map((row) => ({
          time: Math.floor(row[0] / 1000) as UTCTimestamp,
          open: Number(row[1]),
          high: Number(row[2]),
          low: Number(row[3]),
          close: Number(row[4]),
        }));

        if (isCancelled) return;

        candleSeriesRef.current.setData(candles);
        chartRef.current.timeScale().fitContent();

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
  }, [binanceSymbol, timeframe, entry, stopLoss, takeProfit, refreshIntervalMs, onLivePriceUpdate]);

  const actionBadgeClass =
    action === 'Buy'
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
      : action === 'Sell'
        ? 'bg-rose-500/20 text-rose-300 border-rose-400/40'
        : 'bg-slate-500/20 text-slate-300 border-slate-400/40';

  return (
    <div className="px-4 py-3 border-b bg-slate-950">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
            Live Chart ({binanceSymbol})
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

      <div className="relative h-[220px] rounded-md border border-slate-800 overflow-hidden">
        <div ref={containerRef} className="h-full w-full" />

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
