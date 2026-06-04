'use client';

import { useCallback, useState } from 'react';
import type { TradingAction, TradingOpinion } from '@/types/trading';
import { useAuthContext } from '@/hooks/use-auth-context';
import { toast } from 'sonner';
import TradingViewMiniChart from '@/components/data-cards/tradingview-mini-chart';
import { isActionableTradingOpinion } from '@/lib/trading/opinion-engine';
import { formatTradingPrice } from '@/lib/trading/price-format';

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
      return 'text-slate-100 bg-slate-800/80 border-slate-700';
    default:
      return 'text-slate-100 bg-slate-800/80 border-slate-700';
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
      return 'bg-slate-800 text-slate-200 border-slate-700';
    default:
      return 'bg-slate-800 text-slate-200 border-slate-700';
  }
}

function formatConfidence(confidence: number, action: TradingAction): string {
  if (action === 'Hold' || confidence <= 0) {
    return 'No trade';
  }

  return `${Math.round(confidence * 100)}% signal agreement`;
}

function formatNewsScore(score: number): string {
  return score >= 0 ? `+${score.toFixed(2)}` : score.toFixed(2);
}

const tradingTimestampFormatter = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: 'short',
  second: '2-digit',
  timeZone: 'UTC',
  timeZoneName: 'short',
  year: 'numeric',
});

function formatTradingTimestamp(timestamp: number): string {
  return tradingTimestampFormatter.format(new Date(timestamp));
}

async function readTradingMonitorError(
  response: Response,
  fallbackMessage: string
) {
  const payload = (await response.json().catch(() => null)) as
    | { error?: unknown }
    | null;

  return typeof payload?.error === 'string' && payload.error.trim()
    ? payload.error
    : fallbackMessage;
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

  const handleLivePriceUpdate = useCallback((price: number, updatedAt: number) => {
    setLivePrice(price);
    setLiveUpdatedAt(updatedAt);
  }, []);

  const isMonitorActive = monitorStatus === 'active';
  const hasMonitorError = monitorStatus === 'error';
  const isActionableTrade = isActionableTradingOpinion(opinion);

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    if (!user) {
      return {};
    }

    const token = await user.getIdToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const handleStartMonitor = async () => {
    if (!chatId || !user) return;

    if (!isActionableTrade) {
      toast.error('No valid trade reason available. Monitor was not started.');
      return;
    }

    try {
      setIsLoading(true);
      const authHeaders = await getAuthHeaders();

      const response = await fetch('/api/trading/monitors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
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
        throw new Error(
          await readTradingMonitorError(response, 'Failed to start monitor')
        );
      }

      const data = (await response.json().catch(() => null)) as
        | { monitorId?: unknown }
        | null;
      if (typeof data?.monitorId !== 'string' || !data.monitorId.trim()) {
        throw new Error('Monitor was created without a valid monitor id.');
      }

      setMonitorId(data.monitorId);
      setMonitorStatus('active');
      toast.success(`Monitoring ${opinion.symbol} started`);

      onMonitorStatusChange?.(data.monitorId, true);
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Failed to start monitor';
      setMonitorStatus('error');
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopMonitor = async () => {
    if (!monitorId) return;

    try {
      setIsLoading(true);
      const authHeaders = await getAuthHeaders();

      const response = await fetch(`/api/trading/monitors/${monitorId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ isActive: false }),
      });

      if (!response.ok) {
        throw new Error(
          await readTradingMonitorError(response, 'Failed to stop monitor')
        );
      }

      setMonitorStatus('inactive');
      toast.success(`Monitoring ${opinion.symbol} stopped`);

      onMonitorStatusChange?.(monitorId, false);
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Failed to stop monitor';
      setMonitorStatus('error');
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const colorClass = getActionColor(opinion.action);
  const actionMarker = getActionMarker(opinion.action);
  const confidencePercent = formatConfidence(opinion.confidence, opinion.action);
  const effectivePrice = livePrice ?? opinion.entry;
  const formatPrice = (value: number | undefined) => formatTradingPrice(value, opinion.symbol);

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
    <div className="w-full max-w-full min-w-0 overflow-hidden rounded-[8px] border border-slate-800/90 bg-slate-950 text-slate-100 shadow-sm shadow-slate-950/[0.08]">
      <div className={`border-b p-4 ${colorClass}`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[8px] border border-current/20 bg-black/20 text-3xl font-semibold tracking-tight">
                {actionMarker}
              </span>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold">{opinion.action} setup</h3>
                <p className="truncate text-sm opacity-75">
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

      <div className="border-b border-slate-800 bg-slate-950/85 px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-300">
            Signal Quality
          </span>
          <span className="text-lg font-bold">{confidencePercent}</span>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-[8px] bg-slate-800">
          <div
            className={`h-full transition-all ${
              opinion.action === 'Buy'
                ? 'bg-green-500'
                : opinion.action === 'Sell'
                  ? 'bg-red-500'
                  : 'bg-slate-400'
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
        onLivePriceUpdate={handleLivePriceUpdate}
      />

      <div className="border-b border-slate-800 bg-slate-950 px-4 py-3">
        <p className="mb-1 text-xs font-semibold text-emerald-300">
          Live Guidance
        </p>
        <p className="text-xs leading-relaxed text-slate-300">{liveGuidance}</p>
        {liveUpdatedAt && (
          <p className="mt-2 text-[11px] text-slate-500">
            Live price: {formatPrice(effectivePrice)} at {formatTradingTimestamp(liveUpdatedAt)}
          </p>
        )}
      </div>

      <div className="border-b border-slate-800 bg-slate-950/85 px-4 py-3">
        <p className="mb-2 text-sm font-semibold text-slate-300">Reasoning</p>
        <p className="text-sm leading-relaxed text-slate-400">
          {opinion.reason}
        </p>
      </div>

      {opinion.practicalAnalysis && (
        <div className="border-b border-cyan-500/20 bg-cyan-500/10 px-4 py-3">
          <p className="mb-1 text-xs font-semibold text-cyan-300">
            Practical Analysis
          </p>
          <p className="text-xs leading-relaxed text-cyan-100/90">
            {opinion.practicalAnalysis}
          </p>
        </div>
      )}

      {(typeof opinion.setupType === 'string' || typeof opinion.supportLevel === 'number' || typeof opinion.resistanceLevel === 'number' || typeof opinion.invalidationLevel === 'number') && (
        <div className="border-b border-slate-800 bg-slate-950 px-4 py-3">
          <p className="mb-2 text-sm font-semibold text-slate-300">
            Practical Trade Note
          </p>
          <div className="grid grid-cols-1 gap-2 text-xs text-slate-200 sm:grid-cols-2">
            {typeof opinion.setupType === 'string' && (
              <div className="rounded-[8px] border border-slate-800 bg-slate-900/70 px-3 py-2 shadow-sm shadow-slate-950/20">
                <span className="block text-[11px] font-medium text-slate-500">Setup</span>
                <span className="font-semibold capitalize">{opinion.setupType.replace('_', ' ')}</span>
              </div>
            )}
            {typeof opinion.supportLevel === 'number' && (
              <div className="rounded-[8px] border border-slate-800 bg-slate-900/70 px-3 py-2 shadow-sm shadow-slate-950/20">
                <span className="block text-[11px] font-medium text-slate-500">Support / Downside trigger</span>
                <span className="font-semibold">{formatPrice(opinion.supportLevel)}</span>
              </div>
            )}
            {typeof opinion.resistanceLevel === 'number' && (
              <div className="rounded-[8px] border border-slate-800 bg-slate-900/70 px-3 py-2 shadow-sm shadow-slate-950/20">
                <span className="block text-[11px] font-medium text-slate-500">Resistance / Upside trigger</span>
                <span className="font-semibold">{formatPrice(opinion.resistanceLevel)}</span>
              </div>
            )}
            {typeof opinion.invalidationLevel === 'number' && (
              <div className="rounded-[8px] border border-slate-800 bg-slate-900/70 px-3 py-2 shadow-sm shadow-slate-950/20">
                <span className="block text-[11px] font-medium text-slate-500">Invalidation</span>
                <span className="font-semibold">{formatPrice(opinion.invalidationLevel)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {(opinion.entry || opinion.stopLoss || opinion.takeProfit) && (
        <div className="border-b border-slate-800 bg-slate-950/85 px-4 py-3">
          <p className="mb-2 text-sm font-semibold text-slate-300">Levels</p>
          <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3 sm:gap-4">
            {opinion.entry && (
              <div>
                <p className="font-semibold text-slate-400">Entry</p>
                <p className="text-lg font-bold text-blue-400">
                  {formatPrice(opinion.entry)}
                </p>
              </div>
            )}
            {opinion.stopLoss && (
              <div>
                <p className="font-semibold text-slate-400">Stop Loss</p>
                <p className="text-lg font-bold text-red-400">
                  {formatPrice(opinion.stopLoss)}
                </p>
              </div>
            )}
            {opinion.takeProfit && (
              <div>
                <p className="font-semibold text-slate-400">Take Profit</p>
                <p className="text-lg font-bold text-green-400">
                  {formatPrice(opinion.takeProfit)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {(typeof opinion.supportLevel === 'number' || typeof opinion.resistanceLevel === 'number' || typeof opinion.invalidationLevel === 'number') && (
        <div className="border-b border-slate-800 bg-slate-950 px-4 py-3">
          <p className="mb-2 text-sm font-semibold text-slate-300">Trade Map</p>
          <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3 sm:gap-4">
            {typeof opinion.supportLevel === 'number' && (
              <div>
                <p className="font-semibold text-slate-400">Support</p>
                <p className="text-lg font-bold text-emerald-400">
                  {formatPrice(opinion.supportLevel)}
                </p>
              </div>
            )}
            {typeof opinion.resistanceLevel === 'number' && (
              <div>
                <p className="font-semibold text-slate-400">Resistance</p>
                <p className="text-lg font-bold text-amber-400">
                  {formatPrice(opinion.resistanceLevel)}
                </p>
              </div>
            )}
            {typeof opinion.invalidationLevel === 'number' && (
              <div>
                <p className="font-semibold text-slate-400">Invalidation</p>
                <p className="text-lg font-bold text-rose-400">
                  {formatPrice(opinion.invalidationLevel)}
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
        <div className="border-b border-slate-800 bg-slate-950 px-4 py-3">
          <p className="mb-2 text-sm font-semibold text-slate-300">
            Research Evidence
          </p>
          {typeof opinion.newsSentimentScore === 'number' && (
            <p className="mb-2 text-xs text-slate-300">
              News calculation: score{' '}
              <span className="font-semibold text-slate-100">{formatNewsScore(opinion.newsSentimentScore)}</span>
              {typeof opinion.newsBullishCount === 'number' && typeof opinion.newsBearishCount === 'number'
                ? ` (${opinion.newsBullishCount} bullish vs ${opinion.newsBearishCount} bearish)`
                : ''}
              {typeof opinion.newsConsensus === 'number' &&
              typeof opinion.newsBullishCount === 'number' &&
              typeof opinion.newsBearishCount === 'number' &&
              opinion.newsBullishCount + opinion.newsBearishCount > 0
                ? `, ${Math.round(opinion.newsConsensus * 100)}% consensus`
                : ''}
              .
            </p>
          )}
          {opinion.marketDataSource && (
            <p className="mb-2 text-xs text-slate-400">
              Live market data source: <span className="font-semibold text-slate-200">{opinion.marketDataSource}</span>
            </p>
          )}
          {opinion.researchSummary && opinion.action !== 'Hold' && (
            <p className="mb-3 text-xs leading-relaxed text-slate-300">
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
                  className="rounded-[8px] border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-800"
                >
                  {source.source}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 border-t border-slate-800 bg-slate-950 px-4 py-3">
        {!isMonitorActive ? (
          <button
            onClick={handleStartMonitor}
            disabled={isLoading || !isActionableTrade}
            className="flex-1 rounded-[8px] bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-500"
          >
            {isLoading ? 'Starting...' : isActionableTrade ? 'Start Monitor' : 'No Valid Trade'}
          </button>
        ) : (
          <button
            onClick={handleStopMonitor}
            disabled={isLoading}
            className="flex-1 rounded-[8px] bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-500"
          >
            {isLoading ? 'Stopping...' : 'Stop Monitor'}
          </button>
        )}

        {hasMonitorError && (
          <div className="flex flex-1 items-center rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
            Monitor Error
          </div>
        )}
      </div>

      <div className="border-t border-slate-800 bg-slate-950 px-4 py-2 text-xs text-slate-500">
        Data fetched: {formatTradingTimestamp(opinion.fetchedAt)}
      </div>
    </div>
  );
}
