/**
 * Trading Monitor Jobs Engine
 * Background job that polls active monitors and updates trades.
 */

import { Firestore, addDoc, collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
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
import {
  tradingMonitorConverter,
  updateMonitorWithError,
  updateMonitorWithOpinion,
} from '@/lib/firebase/trading-monitors-schema';
import { fetchLiveMarketData } from '@/lib/trading/market-data';

export interface MonitorCycleResult {
  jobsProcessed: number;
  updated: number;
  errored: number;
  successes: number;
}

async function fetchMarketData(symbol: string, timeframe: string): Promise<MarketData> {
  return fetchLiveMarketData(symbol, timeframe as TradingMonitor['timeframe']);
}

export async function runMonitorCycle(db: Firestore): Promise<MonitorCycleResult> {
  const result: MonitorCycleResult = {
    jobsProcessed: 0,
    updated: 0,
    errored: 0,
    successes: 0,
  };

  const now = Date.now();

  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const monitorsRef = collection(db, `users/${userId}/trading_monitors`).withConverter(tradingMonitorConverter);
      const q = query(monitorsRef, where('isActive', '==', true), where('nextPollAt', '<=', now));
      const monitorsSnapshot = await getDocs(q);

      for (const monitorDoc of monitorsSnapshot.docs) {
        result.jobsProcessed++;
        const monitor = monitorDoc.data();

        try {
          await processMonitor(db, userId, monitor, now);
          result.updated++;
          result.successes++;
        } catch (error) {
          result.errored++;
          console.error(`[Monitor] Error processing monitor ${monitor.id} for user ${userId}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('[Monitor Runner] Error during cycle:', error);
    result.errored++;
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

    const chatRef = doc(db, `users/${userId}/chats/${monitor.chat_id}`);
    const messagesRef = collection(chatRef, 'messages');

    await addDoc(messagesRef, {
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
    console.error('[Monitor] Error appending update message:', error);
  }
}

async function updateMonitorInFirestore(
  db: Firestore,
  userId: string,
  monitor: TradingMonitor
): Promise<void> {
  const monitorRef = doc(db, `users/${userId}/trading_monitors/${monitor.id}`).withConverter(
    tradingMonitorConverter
  );

  await updateDoc(monitorRef, tradingMonitorConverter.toFirestore(monitor));
}
