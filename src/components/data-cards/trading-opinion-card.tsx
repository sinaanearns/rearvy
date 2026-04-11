/**
 * Trading Opinion Card Component
 * Displays Buy/Sell/Hold recommendations with confidence, reasoning, and entry/exit levels
 * Includes monitor controls and status badges
 */

'use client';

import React, { useState } from 'react';
import { TradingOpinion, TradingAction } from '@/types/trading';
import { useAuthContext } from '@/hooks/use-auth-context';
import { toast } from 'sonner';
import TradingViewMiniChart from '@/components/data-cards/tradingview-mini-chart';

interface TradingOpinionCardProps {
  opinion: TradingOpinion;
  chatId?: string;
  onMonitorStatusChange?: (monitorId: string, isActive: boolean) => void;
}

/**
 * Get color scheme for action
 */
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

/**
 * Get icon for action
 */
function getActionIcon(action: TradingAction): string {
  switch (action) {
    case 'Buy':
      return '📈';
    case 'Sell':
      return '📉';
    case 'Hold':
      return '⏸️';
    default:
      return '⏸️';
  }
}

/**
 * Get badge color for monitor status
 */
function getMonitorBadgeColor(status?: string): string {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'error':
      return 'bg-red-100 text-red-800 border-red-300';
    case 'inactive':
      return 'bg-gray-100 text-gray-800 border-gray-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
}

/**
 * Format confidence as percentage
 */
function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

/**
 * Format number with commas and decimals
 */
function formatPrice(price: number | undefined): string {
  if (price === undefined) return '—';
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
  const [liveUpdatedAt, setLiveUpdatedAt] = useState<number | undefined>(undefined);
  const [monitorStatus, setMonitorStatus] = useState<'active' | 'inactive' | 'error' | undefined>(
    undefined
  );
  const [monitorId, setMonitorId] = useState<string | undefined>(undefined);

  const isMonitorActive = monitorStatus === 'active';
  const hasMonitorError = monitorStatus === 'error';

  const handleStartMonitor = async () => {
    if (!chatId || !user) return;

    try {
      setIsLoading(true);

      const response = await fetch('/api/trading/monitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          symbol: opinion.symbol,
          timeframe: opinion.timeframe,
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
      const errorMsg = error instanceof Error ? error.message : 'Failed to start monitor';
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
      const errorMsg = error instanceof Error ? error.message : 'Failed to stop monitor';
      toast.error(errorMsg);
      console.error('Error stopping monitor:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const colorClass = getActionColor(opinion.action);
  const actionIcon = getActionIcon(opinion.action);
  const confidencePercent = formatConfidence(opinion.confidence);
  const effectivePrice = livePrice ?? opinion.entry;

  const liveGuidance = (() => {
    if (!effectivePrice) {
      return 'Waiting for live price feed. Avoid taking a position until the market feed confirms current price.';
    }

    if (opinion.action === 'Hold') {
      return `Hold. Price is ${formatPrice(effectivePrice)}. Wait for cleaner momentum before opening a new trade.`;
    }

    if (opinion.action === 'Buy') {
      const nearEntry = opinion.entry ? effectivePrice <= opinion.entry * 1.003 : false;
      return nearEntry
        ? `Buy setup is active near entry. Keep stop at ${formatPrice(opinion.stopLoss)} and respect risk if volatility expands.`
        : `Buy bias remains, but wait for a pullback closer to entry (${formatPrice(opinion.entry)}). Avoid chasing extended candles.`;
    }

    const nearEntry = opinion.entry ? effectivePrice >= opinion.entry * 0.997 : false;
    return nearEntry
      ? `Sell setup is active near entry. Protect downside with stop at ${formatPrice(opinion.stopLoss)} and size conservatively.`
      : `Sell bias remains, but wait for price to retrace toward entry (${formatPrice(opinion.entry)}).`;
  })();

  return (
    <div className="w-full border border-zinc-800 rounded-lg shadow-sm bg-zinc-900 text-zinc-100 overflow-hidden">
      {/* Header with action, symbol, and monitor badge */}
      <div className={`p-4 border-b ${colorClass}`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{actionIcon}</span>
              <div>
                <h3 className="text-lg font-bold">{opinion.action}</h3>
                <p className="text-sm opacity-75">
                  {opinion.symbol} • {opinion.timeframe}
                </p>
              </div>
            </div>
          </div>

          {/* Monitor status badge */}
          {monitorStatus && (
            <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${getMonitorBadgeColor(monitorStatus)}`}>
              {monitorStatus === 'active' && '🟢 Monitoring'}
              {monitorStatus === 'inactive' && '⚪ Not Monitoring'}
              {monitorStatus === 'error' && '🔴 Monitor Error'}
            </div>
          )}
        </div>
      </div>

      {/* Confidence section */}
      <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-zinc-300">Confidence</span>
          <span className="text-lg font-bold">{confidencePercent}</span>
        </div>
        {/* Confidence bar */}
        <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              opinion.action === 'Buy'
                ? 'bg-green-500'
                : opinion.action === 'Sell'
                  ? 'bg-red-500'
                  : 'bg-gray-400'
            }`}
            style={{ width: `${opinion.confidence * 100}%` }}
          />
        </div>
      </div>

      <TradingViewMiniChart
        symbol={opinion.symbol}
        timeframe={opinion.timeframe}
        action={opinion.action}
        entry={opinion.entry}
        stopLoss={opinion.stopLoss}
        takeProfit={opinion.takeProfit}
        onLivePriceUpdate={(price, updatedAt) => {
          setLivePrice(price);
          setLiveUpdatedAt(updatedAt);
        }}
      />

      <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-950">
        <p className="text-xs font-semibold text-emerald-300 mb-1">Live Guidance</p>
        <p className="text-xs text-zinc-300 leading-relaxed">{liveGuidance}</p>
        {liveUpdatedAt && (
          <p className="mt-2 text-[11px] text-zinc-500">
            Live price: {formatPrice(effectivePrice)} at {new Date(liveUpdatedAt).toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Reasoning */}
      <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900">
        <p className="text-sm font-semibold text-zinc-300 mb-2">Reasoning</p>
        <p className="text-sm text-zinc-400 leading-relaxed">{opinion.reason}</p>
      </div>

      {/* Entry/Stop/TP levels (if provided) */}
      {(opinion.entry || opinion.stopLoss || opinion.takeProfit) && (
        <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900">
          <p className="text-sm font-semibold text-zinc-300 mb-2">Levels</p>
          <div className="grid grid-cols-3 gap-4 text-xs">
            {opinion.entry && (
              <div>
                <p className="font-semibold text-zinc-400">Entry</p>
                <p className="text-lg font-bold text-blue-600">{formatPrice(opinion.entry)}</p>
              </div>
            )}
            {opinion.stopLoss && (
              <div>
                <p className="font-semibold text-zinc-400">Stop Loss</p>
                <p className="text-lg font-bold text-red-600">{formatPrice(opinion.stopLoss)}</p>
              </div>
            )}
            {opinion.takeProfit && (
              <div>
                <p className="font-semibold text-zinc-400">Take Profit</p>
                <p className="text-lg font-bold text-green-600">{formatPrice(opinion.takeProfit)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Risk notes */}
      {opinion.riskNotes && (
        <div className="px-4 py-3 border-b border-amber-500/20 bg-amber-500/10">
          <p className="text-xs font-semibold text-amber-300 mb-1">⚠️ Risk Notes</p>
          <p className="text-xs text-amber-200/90 leading-relaxed">{opinion.riskNotes}</p>
        </div>
      )}

      {/* Monitor controls footer */}
      <div className="px-4 py-3 bg-zinc-950 border-t border-zinc-800 flex gap-2">
        {!isMonitorActive ? (
          <button
            onClick={handleStartMonitor}
            disabled={isLoading}
            className="flex-1 px-3 py-2 bg-green-600 text-white text-sm font-semibold rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Starting...' : '▶ Start Monitor'}
          </button>
        ) : (
          <button
            onClick={handleStopMonitor}
            disabled={isLoading}
            className="flex-1 px-3 py-2 bg-red-600 text-white text-sm font-semibold rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Stopping...' : '⏹ Stop Monitor'}
          </button>
        )}

        {hasMonitorError && (
          <div className="flex-1 px-3 py-2 bg-red-50 text-red-700 text-xs font-semibold rounded border border-red-200 flex items-center">
            ⚠️ Monitor Error
          </div>
        )}
      </div>

      {/* Data freshness footer */}
      <div className="px-4 py-2 bg-zinc-950 text-xs text-zinc-500 border-t border-zinc-800">
        Data fetched: {new Date(opinion.fetchedAt).toLocaleString()}
      </div>
    </div>
  );
}
