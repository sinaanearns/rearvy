'use client';

import { useState } from 'react';
import type { TradingAction, TradingOpinion } from '@/types/trading';
import { useAuthContext } from '@/hooks/use-auth-context';
import { toast } from 'sonner';
import TradingViewMiniChart from '@/components/data-cards/tradingview-mini-chart';
import { isActionableTradingOpinion } from '@/lib/trading/opinion-engine';

interface TradingOpinionCardProps {
  opinion: TradingOpinion;
  chatId?: string;
  onMonitorStatusChange?: (monitorId: string, isActive: boolean) => void;
}

function getActionColor(action: TradingAction): string {
  switch (action) {
    case 'Buy':
      return 'text-emerald-200 bg-emerald-500/15 border-emerald-500/30';
    case 'Sell':
      return 'text-rose-200 bg-rose-500/15 border-rose-500/30';
    case 'Hold':
      return 'text-zinc-200 bg-zinc-800 border-zinc-700';
    default:
      return 'text-zinc-200 bg-zinc-800 border-zinc-700';
  }
}

function getActionMarker(action: TradingAction): string {
  switch (action) {
    case 'Buy':
      return 'B';
    case 'Sell':
      return 'S';
    case 'Hold':
      return 'H';
    default:
      return 'H';
  }
}

function getMonitorBadgeColor(status?: string): string {
  switch (status) {
    case 'active':
      return 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30';
    case 'error':
      return 'bg-rose-500/15 text-rose-200 border-rose-500/30';
    case 'inactive':
      return 'bg-zinc-800 text-zinc-200 border-zinc-700';
    default:
      return 'bg-zinc-800 text-zinc-200 border-zinc-700';
  }
}

function formatConfidence(confidence: number, action: TradingAction): string {
  if (action === 'Hold' || confidence <= 0) {
    return 'No trade';
  }

  return `${Math.round(confidence * 100)}% signal agreement`;
}

function formatPrice(price: number | undefined): string {
  if (price === undefined) return '--';

  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(price);
}

export default function TradingOpinionCard({
  opinion,
  chatId,
  onMonitorStatusChange,
}: TradingOpinionCardProps) {
  const { user } = useAuthContext();
  const [isLoading, setIsLoading] = useState(false);
  const [livePrice, setLivePrice] = useState<number | undefined>(undefined);
  const [liveUpdatedAt, setLiveUpdatedAt] = useState<number | undefined>(
    undefined
  );
  const [monitorStatus, setMonitorStatus] = useState<
    'active' | 'inactive' | 'error' | undefined
  >(undefined);
  const [monitorId, setMonitorId] = useState<string | undefined>(undefined);

  const isMonitorActive = monitorStatus === 'active';
  const hasMonitorError = monitorStatus === 'error';
  const isActionableTrade = isActionableTradingOpinion(opinion);

  const handleStartMonitor = async () => {
    if (!chatId || !user) return;

    if (!isActionableTrade) {
      toast.error('No valid trade reason available. Monitor was not started.');
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch('/api/trading/monitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          symbol: opinion.symbol,
          timeframe: opinion.timeframe,
          action: opinion.action,
          confidence: opinion.confidence,
          reason: opinion.reason,
          entry: opinion.entry,
          stopLoss: opinion.stopLoss,
          takeProfit: opinion.takeProfit,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start monitor');
      }

      const data = await response.json();
      setMonitorId(data.monitorId);
      setMonitorStatus('active');
      toast.success(`Monitoring ${opinion.symbol} started`);

      onMonitorStatusChange?.(data.monitorId, true);
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Failed to start monitor';
      toast.error(errorMsg);
      console.error('Error starting monitor:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopMonitor = async () => {
    if (!monitorId) return;

    try {
      setIsLoading(true);

      const response = await fetch(`/api/trading/monitors/${monitorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to stop monitor');
      }

      setMonitorStatus('inactive');
      toast.success(`Monitoring ${opinion.symbol} stopped`);

      onMonitorStatusChange?.(monitorId, false);
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Failed to stop monitor';
      toast.error(errorMsg);
      console.error('Error stopping monitor:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const colorClass = getActionColor(opinion.action);
  const actionMarker = getActionMarker(opinion.action);
  const confidencePercent = formatConfidence(opinion.confidence, opinion.action);
  const effectivePrice = livePrice ?? opinion.entry;

  const liveGuidance = (() => {
    if (!effectivePrice) {
      return 'Waiting for live price feed. Avoid taking a position until the market feed confirms current price.';
    }

    if (opinion.action === 'Hold') {
      return `Hold. Price is ${formatPrice(effectivePrice)}. Wait for cleaner momentum before opening a new trade.`;
    }

    if (opinion.action === 'Buy') {
      const nearEntry = opinion.entry
        ? effectivePrice <= opinion.entry * 1.003
        : false;

      return nearEntry
        ? `Buy setup is active near entry. Keep stop at ${formatPrice(opinion.stopLoss)} and respect risk if volatility expands.`
        : `Buy bias remains, but wait for a pullback closer to entry (${formatPrice(opinion.entry)}). Avoid chasing extended candles.`;
    }

    const nearEntry = opinion.entry
      ? effectivePrice >= opinion.entry * 0.997
      : false;

    return nearEntry
      ? `Sell setup is active near entry. Protect downside with stop at ${formatPrice(opinion.stopLoss)} and size conservatively.`
      : `Sell bias remains, but wait for price to retrace toward entry (${formatPrice(opinion.entry)}).`;
  })();

  return (
    <div className="w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-100 shadow-sm">
      <div className={`border-b p-4 ${colorClass}`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <span className="text-3xl font-black tracking-tight">
                {actionMarker}
              </span>
              <div>
                <h3 className="text-lg font-bold">{opinion.action}</h3>
                <p className="text-sm opacity-75">
                  {opinion.symbol} | {opinion.timeframe}
                </p>
              </div>
            </div>
          </div>

          {monitorStatus && (
            <div
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${getMonitorBadgeColor(
                monitorStatus
              )}`}
            >
              {monitorStatus === 'active' && 'Active monitor'}
              {monitorStatus === 'inactive' && 'Not monitoring'}
              {monitorStatus === 'error' && 'Monitor error'}
            </div>
          )}
        </div>
      </div>

      <div className="border-b border-zinc-800 bg-zinc-900 px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-zinc-300">
            Signal Quality
          </span>
          <span className="text-lg font-bold">{confidencePercent}</span>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className={`h-full transition-all ${
              opinion.action === 'Buy'
                ? 'bg-green-500'
                : opinion.action === 'Sell'
                  ? 'bg-red-500'
                  : 'bg-gray-400'
            }`}
            style={{ width: `${isActionableTrade ? opinion.confidence * 100 : 0}%` }}
          />
        </div>
      </div>

      <TradingViewMiniChart
        symbol={opinion.symbol}
        timeframe={opinion.timeframe}
        action={opinion.action}
        confidence={opinion.confidence}
        entry={opinion.entry}
        stopLoss={opinion.stopLoss}
        takeProfit={opinion.takeProfit}
        onLivePriceUpdate={(price, updatedAt) => {
          setLivePrice(price);
          setLiveUpdatedAt(updatedAt);
        }}
      />

      <div className="border-b border-zinc-800 bg-zinc-950 px-4 py-3">
        <p className="mb-1 text-xs font-semibold text-emerald-300">
          Live Guidance
        </p>
        <p className="text-xs leading-relaxed text-zinc-300">{liveGuidance}</p>
        {liveUpdatedAt && (
          <p className="mt-2 text-[11px] text-zinc-500">
            Live price: {formatPrice(effectivePrice)} at{' '}
            {new Date(liveUpdatedAt).toLocaleTimeString()}
          </p>
        )}
      </div>

      <div className="border-b border-zinc-800 bg-zinc-900 px-4 py-3">
        <p className="mb-2 text-sm font-semibold text-zinc-300">Reasoning</p>
        <p className="text-sm leading-relaxed text-zinc-400">
          {opinion.reason}
        </p>
      </div>

      {(opinion.entry || opinion.stopLoss || opinion.takeProfit) && (
        <div className="border-b border-zinc-800 bg-zinc-900 px-4 py-3">
          <p className="mb-2 text-sm font-semibold text-zinc-300">Levels</p>
          <div className="grid grid-cols-3 gap-4 text-xs">
            {opinion.entry && (
              <div>
                <p className="font-semibold text-zinc-400">Entry</p>
                <p className="text-lg font-bold text-blue-400">
                  {formatPrice(opinion.entry)}
                </p>
              </div>
            )}
            {opinion.stopLoss && (
              <div>
                <p className="font-semibold text-zinc-400">Stop Loss</p>
                <p className="text-lg font-bold text-red-400">
                  {formatPrice(opinion.stopLoss)}
                </p>
              </div>
            )}
            {opinion.takeProfit && (
              <div>
                <p className="font-semibold text-zinc-400">Take Profit</p>
                <p className="text-lg font-bold text-green-400">
                  {formatPrice(opinion.takeProfit)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {opinion.riskNotes && (
        <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-3">
          <p className="mb-1 text-xs font-semibold text-amber-300">
            Risk Notes
          </p>
          <p className="text-xs leading-relaxed text-amber-200/90">
            {opinion.riskNotes}
          </p>
        </div>
      )}

      {(opinion.marketDataSource || opinion.researchSources?.length) && (
        <div className="border-b border-zinc-800 bg-zinc-950 px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Research Evidence
          </p>
          {opinion.marketDataSource && (
            <p className="mb-2 text-xs text-zinc-400">
              Live market data source: <span className="font-semibold text-zinc-200">{opinion.marketDataSource}</span>
            </p>
          )}
          {opinion.researchSummary && (
            <p className="mb-3 text-xs leading-relaxed text-zinc-300">
              {opinion.researchSummary}
            </p>
          )}
          {opinion.researchSources && opinion.researchSources.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {opinion.researchSources.map((source) => (
                <a
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-[11px] text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-800"
                >
                  {source.source}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 border-t border-zinc-800 bg-zinc-950 px-4 py-3">
        {!isMonitorActive ? (
          <button
            onClick={handleStartMonitor}
            disabled={isLoading || !isActionableTrade}
            className="flex-1 rounded bg-green-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isLoading ? 'Starting...' : isActionableTrade ? 'Start Monitor' : 'No Valid Trade'}
          </button>
        ) : (
          <button
            onClick={handleStopMonitor}
            disabled={isLoading}
            className="flex-1 rounded bg-red-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isLoading ? 'Stopping...' : 'Stop Monitor'}
          </button>
        )}

        {hasMonitorError && (
          <div className="flex flex-1 items-center rounded border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
            Monitor Error
          </div>
        )}
      </div>

      <div className="border-t border-zinc-800 bg-zinc-950 px-4 py-2 text-xs text-zinc-500">
        Data fetched: {new Date(opinion.fetchedAt).toLocaleString()}
      </div>
    </div>
  );
}
