/**
 * Trading Monitor Jobs Engine
 * Background job that polls active monitors and updates trades
 * Implements reactive polling strategy for efficiency
 *
 * Entry point for Cloud Functions / scheduled tasks
 */

import { Firestore, collection, query, where, getDocs, doc, updateDoc, addDoc } from 'firebase/firestore';
import { TradingMonitor, MonitorUpdateMessage, TradingOpinion } from '@/types/trading';
import {
  tradingMonitorConverter,
  updateMonitorWithOpinion,
  updateMonitorWithError,
} from '@/lib/firebase/trading-monitors-schema';
import {
  calculateNextPollInterval,
  isDataFresh,
  validateMarketData,
  createFallbackHoldOpinion,
  shouldUpdateOnConfidenceChange,
  DEFAULT_GUARDRAILS,
} from '@/lib/trading/opinion-engine';

/**
 * Result metrics from a monitor cycle
 */
export interface MonitorCycleResult {
  jobsProcessed: number;
  updated: number;
  errored: number;
  successes: number;
}

/**
 * Main monitor polling cycle
 * Queries all active monitors due for polling and updates them
 * 
 * Process:
 * 1. Query all active monitors where nextPollAt <= now
 * 2. For each monitor:
 *    a. Fetch minimal market data (reactive polling)
 *    b. If data changed or time elapsed, compute new opinion
 *    c. Compare to lastAction/lastConfidence
 *    d. If update needed, append message to chat
 *    e. Update monitor record with new state
 * 3. Return metrics
 *
 * @param db - Firestore instance
 * @returns MonitorCycleResult metrics
 */
export async function runMonitorCycle(db: Firestore): Promise<MonitorCycleResult> {
  const result: MonitorCycleResult = {
    jobsProcessed: 0,
    updated: 0,
    errored: 0,
    successes: 0,
  };

  const now = Date.now();

  try {
    // Step 1: Query all active monitors across all users
    // Note: This requires a collection group query in production
    // For now, we use the pattern: iterate through users that have monitors
    const allUsersColRef = collection(db, 'users');
    const usersSnapshot = await getDocs(allUsersColRef);

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;

      // Step 1a: Get all active monitors for this user that are due for polling
      const monitorsRef = collection(db, `users/${userId}/trading_monitors`).withConverter(
        tradingMonitorConverter
      );

      const q = query(
        monitorsRef,
        where('isActive', '==', true),
        where('nextPollAt', '<=', now) // Only monitors due for polling
      );

      const monitorsSnapshot = await getDocs(q);

      for (const monitorDoc of monitorsSnapshot.docs) {
        result.jobsProcessed++;
        const monitor = monitorDoc.data();

        try {
          // Step 2: Process this monitor
          await processMonitor(db, userId, monitor, now);
          result.updated++;
          result.successes++;
        } catch (error) {
          result.errored++;
          console.error(
            `[Monitor] Error processing monitor ${monitor.id} for user ${userId}:`,
            error
          );
        }
      }
    }
  } catch (error) {
    console.error('[Monitor Runner] Error during cycle:', error);
    result.errored++;
  }

  return result;
}

/**
 * Process a single monitor: fetch data, compute opinion, update if needed
 */
async function processMonitor(
  db: Firestore,
  userId: string,
  monitor: TradingMonitor,
  now: number
): Promise<void> {
  try {
    // Step 1: Fetch minimal market data (reactive polling)
    // TODO: Integrate with real market data provider
    // For Phase 1, use mock/stub data
    const marketData = await fetchMarketData(monitor.symbol, monitor.timeframe);

    // Step 2: Check if data is fresh
    const dataFresh = isDataFresh(marketData?.fetchedAt);

    if (!dataFresh) {
      // Data is stale; update monitor with stale data indication
      // But DON'T change the opinion - just fall back to Hold
      const nextPollAt = now + 5 * 60 * 1000; // Retry in 5 min
      const updatedMonitor = updateMonitorWithError(
        monitor,
        'Data is stale (>1 hour old)',
        nextPollAt
      );
      await updateMonitorInFirestore(db, userId, updatedMonitor);
      return;
    }

    // Step 3: Compute new opinion
    const newOpinion = await computeMonitorOpinion(monitor, marketData);

    // Step 4: Compare to last action
    const actionChanged = newOpinion.action !== monitor.lastAction;
    const confidenceChanged = shouldUpdateOnConfidenceChange(
      monitor.lastConfidence,
      newOpinion.confidence,
      DEFAULT_GUARDRAILS.confidenceThresholdForUpdate
    );

    // Step 5: Determine if update is needed
    const shouldUpdate = actionChanged || confidenceChanged;

    if (shouldUpdate) {
      // Step 5a: Append update message to chat
      await appendMonitorUpdateToChat(db, userId, monitor, newOpinion);
    }

    // Step 6: Calculate next poll time using reactive polling
    const timeSinceLastChange = now - (monitor.lastUpdatedAt || monitor.startedAt);
    const nextPollInterval = calculateNextPollInterval(
      timeSinceLastChange,
      DEFAULT_GUARDRAILS.minPollingIntervalMs,
      0 // No errors - reset error count
    );
    const nextPollAt = now + nextPollInterval;

    // Step 7: Update monitor record in Firestore
    const updatedMonitor = updateMonitorWithOpinion(
      monitor,
      newOpinion.action,
      newOpinion.confidence,
      nextPollAt
    );

    await updateMonitorInFirestore(db, userId, updatedMonitor);
  } catch (error) {
    // Handle errors with exponential backoff
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

/**
 * Fetch minimal market data for reactive polling
 * In Phase 1, returns mock data
 * In production, integrate with market data provider (Alpha Vantage, Polygon, etc.)
 */
async function fetchMarketData(symbol: string, timeframe: string): Promise<any> {
  // TODO: Integrate with actual market data provider
  // For now, return mock data with current timestamp
  return {
    symbol,
    timeframe,
    currentPrice: 45000, // Mock price
    fetchedAt: Date.now(),
    trend: 'up',
  };
}

/**
 * Compute new opinion for monitor
 * Wrapper around opinion engine
 */
async function computeMonitorOpinion(monitor: TradingMonitor, marketData: any): Promise<TradingOpinion> {
  // Check data freshness
  const validation = validateMarketData(marketData);

  if (!validation.sufficient) {
    // Return fallback Hold if data is insufficient
    return createFallbackHoldOpinion(
      monitor.symbol,
      monitor.timeframe,
      `Cannot generate opinion: ${validation.missingFields.length > 0
        ? `missing ${validation.missingFields.join(', ')}`
        : 'data is stale'
      }`
    );
  }

  // TODO: Call actual opinion engine or LLM model
  // For Phase 1, return mock opinion
  return {
    action: 'Hold',
    confidence: 0.5,
    reason: '[Mock opinion from monitor runner]',
    symbol: monitor.symbol,
    timeframe: monitor.timeframe,
    entry: monitor.entry,
    stopLoss: monitor.stopLoss,
    takeProfit: monitor.takeProfit,
    riskNotes: 'This is a mock opinion from the monitor runner.',
    fetchedAt: Date.now(),
  };
}

/**
 * When action changes, append an update message to the chat
 */
async function appendMonitorUpdateToChat(
  db: Firestore,
  userId: string,
  monitor: TradingMonitor,
  newOpinion: TradingOpinion
): Promise<void> {
  try {
    // Step 1: Create update message
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

    // Step 2: Append to chat's messages collection
    // Message structure follows Rearvy's convention:
    // - role: 'assistant'
    // - parts: [{ type: 'text', text: message content }, { type: 'tool-result', output: updateMessage }]
    const chatRef = doc(db, `users/${userId}/chats/${monitor.chat_id}`);

    // Get chat to append message
    const messagesRef = collection(chatRef, 'messages');
    const messageContent = `🔄 **Monitor Update**: ${monitor.symbol} ${newOpinion.action}\\n${newOpinion.reason}`;

    await addDoc(messagesRef, {
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: messageContent,
        },
        {
          type: 'tool-result',
          output: updateMessage,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(
      `[Monitor] Appended update message to chat ${monitor.chat_id} for ${monitor.symbol}: ${newOpinion.action}`
    );
  } catch (error) {
    console.error('[Monitor] Error appending update message:', error);
    // Don't throw - this is non-critical for monitor state tracking
  }
}

/**
 * Update monitor record in Firestore
 */
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
