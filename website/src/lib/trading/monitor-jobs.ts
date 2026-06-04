/**
 * Trading Monitor Jobs Engine
 * Background job that polls active monitors and updates trades.
 */

import type { Firestore } from 'firebase-admin/firestore';
import { MonitorUpdateMessage, TradingMonitor, TradingOpinion } from '@/types/trading';
import {
  DEFAULT_GUARDRAILS,
  calculateNextPollInterval,
  computeOpinion,
  isDataFresh,
  MarketData,
  shouldUpdateOnConfidenceChange,
  validateMarketData,
} from '@/lib/trading/opinion-engine';
import { updateMonitorWithError, updateMonitorWithOpinion } from '@/lib/firebase/trading-monitors-schema';
import { fetchLiveMarketData } from '@/lib/trading/market-data';
import { createServerLogger } from '@/lib/server-logger';

export interface MonitorCycleResult {
  jobsProcessed: number;
  updated: number;
  errored: number;
  successes: number;
  errors: string[];
}

const VALID_TIMEFRAMES: TradingMonitor['timeframe'][] = ['M15', 'M30', 'H1', 'H4', 'D1', 'W1'];
const VALID_ACTIONS: NonNullable<TradingMonitor['lastAction']>[] = ['Buy', 'Sell', 'Hold'];
const log = createServerLogger('TradingMonitorJobs');

async function fetchMarketData(symbol: string, timeframe: TradingMonitor['timeframe']): Promise<MarketData> {
  return fetchLiveMarketData(symbol, timeframe);
}

function parseMonitorDoc(
  id: string,
  raw: FirebaseFirestore.DocumentData
): TradingMonitor | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  if (typeof raw.user_id !== 'string' || typeof raw.chat_id !== 'string') {
    return null;
  }

  if (typeof raw.symbol !== 'string' || typeof raw.timeframe !== 'string') {
    return null;
  }

  if (!VALID_TIMEFRAMES.includes(raw.timeframe as TradingMonitor['timeframe'])) {
    return null;
  }

  const startedAt = typeof raw.startedAt === 'number' ? raw.startedAt : Date.now();

  return {
    id,
    user_id: raw.user_id,
    chat_id: raw.chat_id,
    symbol: raw.symbol,
    timeframe: raw.timeframe as TradingMonitor['timeframe'],
    entry: typeof raw.entry === 'number' ? raw.entry : undefined,
    stopLoss: typeof raw.stopLoss === 'number' ? raw.stopLoss : undefined,
    takeProfit: typeof raw.takeProfit === 'number' ? raw.takeProfit : undefined,
    isActive: raw.isActive !== false,
    startedAt,
    lastUpdatedAt: typeof raw.lastUpdatedAt === 'number' ? raw.lastUpdatedAt : startedAt,
    lastFetchedAt: typeof raw.lastFetchedAt === 'number' ? raw.lastFetchedAt : undefined,
    lastAction:
      typeof raw.lastAction === 'string' &&
      VALID_ACTIONS.includes(raw.lastAction as NonNullable<TradingMonitor['lastAction']>)
        ? (raw.lastAction as NonNullable<TradingMonitor['lastAction']>)
        : undefined,
    lastConfidence: typeof raw.lastConfidence === 'number' ? raw.lastConfidence : undefined,
    errorCount: typeof raw.errorCount === 'number' ? raw.errorCount : 0,
    error: typeof raw.error === 'string' ? raw.error : undefined,
    nextPollAt: typeof raw.nextPollAt === 'number' ? raw.nextPollAt : undefined,
  };
}

function toMonitorDoc(monitor: TradingMonitor) {
  return {
    id: monitor.id,
    user_id: monitor.user_id,
    chat_id: monitor.chat_id,
    symbol: monitor.symbol,
    timeframe: monitor.timeframe,
    entry: monitor.entry ?? null,
    stopLoss: monitor.stopLoss ?? null,
    takeProfit: monitor.takeProfit ?? null,
    isActive: monitor.isActive,
    startedAt: monitor.startedAt,
    lastUpdatedAt: monitor.lastUpdatedAt,
    lastFetchedAt: monitor.lastFetchedAt ?? null,
    lastAction: monitor.lastAction ?? null,
    lastConfidence: monitor.lastConfidence ?? null,
    errorCount: monitor.errorCount,
    error: monitor.error ?? null,
    nextPollAt: monitor.nextPollAt ?? null,
  };
}

export async function runMonitorCycle(db: Firestore): Promise<MonitorCycleResult> {
  const result: MonitorCycleResult = {
    jobsProcessed: 0,
    updated: 0,
    errored: 0,
    successes: 0,
    errors: [],
  };

  const now = Date.now();

  try {
    const dueMonitorsSnapshot = await db
      .collectionGroup('trading_monitors')
      .where('isActive', '==', true)
      .where('nextPollAt', '<=', now)
      .get();

    for (const monitorDoc of dueMonitorsSnapshot.docs) {
      result.jobsProcessed++;

      const userRef = monitorDoc.ref.parent.parent;
      const userId = userRef?.id;
      const monitor = parseMonitorDoc(monitorDoc.id, monitorDoc.data());

      if (!userId || !monitor) {
        result.errored++;
        continue;
      }

      try {
        await processMonitor(db, userId, monitor, now);
        result.updated++;
        result.successes++;
      } catch (error) {
        result.errored++;
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`monitor:${monitor.id}: ${message}`);
        log.error('Error processing monitor:', {
          symbol: monitor.symbol,
          timeframe: monitor.timeframe,
          error: message,
        });
      }
    }
  } catch (error) {
    log.error('Error during cycle:', error);
    result.errored++;
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push(`runner: ${message}`);
  }

  return result;
}

async function processMonitor(
  db: Firestore,
  userId: string,
  monitor: TradingMonitor,
  now: number
): Promise<void> {
  try {
    const marketData = await fetchMarketData(monitor.symbol, monitor.timeframe);

    if (!isDataFresh(marketData.fetchedAt as number | undefined)) {
      const nextPollAt = now + 5 * 60 * 1000;
      const updatedMonitor = updateMonitorWithError(monitor, 'Data is stale or incomplete', nextPollAt);
      await updateMonitorInFirestore(db, userId, updatedMonitor);
      return;
    }

    const validation = validateMarketData(marketData);
    if (!validation.sufficient) {
      const nextPollAt = now + 5 * 60 * 1000;
      const updatedMonitor = updateMonitorWithError(monitor, 'Data is stale or incomplete', nextPollAt);
      await updateMonitorInFirestore(db, userId, updatedMonitor);
      return;
    }

    const newOpinion = await computeOpinion(monitor.symbol, monitor.timeframe, marketData);

    const actionChanged = newOpinion.action !== monitor.lastAction;
    const confidenceChanged = shouldUpdateOnConfidenceChange(
      monitor.lastConfidence,
      newOpinion.confidence,
      DEFAULT_GUARDRAILS.confidenceThresholdForUpdate
    );

    if (actionChanged || confidenceChanged) {
      await appendMonitorUpdateToChat(db, userId, monitor, newOpinion);
    }

    const timeSinceLastChange = now - (monitor.lastUpdatedAt || monitor.startedAt);
    const nextPollInterval = calculateNextPollInterval(
      timeSinceLastChange,
      DEFAULT_GUARDRAILS.minPollingIntervalMs,
      0,
      DEFAULT_GUARDRAILS
    );
    const nextPollAt = now + nextPollInterval;

    const updatedMonitor = updateMonitorWithOpinion(
      monitor,
      newOpinion.action,
      newOpinion.confidence,
      nextPollAt
    );

    await updateMonitorInFirestore(db, userId, updatedMonitor);
  } catch (error) {
    const nextPollInterval = calculateNextPollInterval(
      0,
      DEFAULT_GUARDRAILS.minPollingIntervalMs,
      (monitor.errorCount || 0) + 1,
      DEFAULT_GUARDRAILS
    );
    const nextPollAt = now + nextPollInterval;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    const updatedMonitor = updateMonitorWithError(monitor, errorMsg, nextPollAt);

    await updateMonitorInFirestore(db, userId, updatedMonitor);
    throw error;
  }
}

async function appendMonitorUpdateToChat(
  db: Firestore,
  userId: string,
  monitor: TradingMonitor,
  newOpinion: TradingOpinion
): Promise<void> {
  try {
    const updateMessage: MonitorUpdateMessage = {
      type: 'monitor_update',
      monitorId: monitor.id,
      symbol: monitor.symbol,
      timeframe: monitor.timeframe,
      previousAction: monitor.lastAction,
      currentAction: newOpinion.action,
      currentConfidence: newOpinion.confidence,
      reason: newOpinion.reason,
      timestamp: Date.now(),
      fetchedAt: newOpinion.fetchedAt,
    };

    await db
      .collection('users')
      .doc(userId)
      .collection('chats')
      .doc(monitor.chat_id)
      .collection('messages')
      .add({
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: `🔄 **Monitor Update**: ${monitor.symbol} ${newOpinion.action}\n${newOpinion.reason}`,
        },
        {
          type: 'tool-result',
          output: updateMessage,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } catch (error) {
    log.error('Error appending update message:', error);
  }
}

async function updateMonitorInFirestore(
  db: Firestore,
  userId: string,
  monitor: TradingMonitor
): Promise<void> {
  await db
    .collection('users')
    .doc(userId)
    .collection('trading_monitors')
    .doc(monitor.id)
    .set(toMonitorDoc(monitor), { merge: true });
}
