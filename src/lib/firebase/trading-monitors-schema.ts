/**
 * Firestore Trading Monitors Schema & Converters
 * Handles serialization/deserialization of trading monitor data
 * Firestore path: users/{userId}/trading_monitors/{monitorId}
 */

import { FirestoreDataConverter, QueryConstraint, where, orderBy, limit } from 'firebase/firestore';
import { TradingMonitor, Timeframe } from '@/types/trading';

/**
 * Firestore converter for TradingMonitor documents
 * Ensures consistent serialization and deserialization
 */
export const tradingMonitorConverter: FirestoreDataConverter<TradingMonitor> = {
  toFirestore(monitor: TradingMonitor) {
    return {
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
  },

  fromFirestore(snapshot, options) {
    const data = snapshot.data(options);
    return {
      id: snapshot.id,
      user_id: data.user_id,
      chat_id: data.chat_id,
      symbol: data.symbol,
      timeframe: data.timeframe as Timeframe,
      entry: data.entry || undefined,
      stopLoss: data.stopLoss || undefined,
      takeProfit: data.takeProfit || undefined,
      isActive: data.isActive ?? true,
      startedAt: data.startedAt,
      lastUpdatedAt: data.lastUpdatedAt,
      lastFetchedAt: data.lastFetchedAt || undefined,
      lastAction: data.lastAction || undefined,
      lastConfidence: data.lastConfidence || undefined,
      errorCount: data.errorCount ?? 0,
      error: data.error || undefined,
      nextPollAt: data.nextPollAt || undefined,
    };
  },
};

/**
 * Query constraints for common monitor queries
 */
export const TradingMonitorQueries = {
  /**
   * Get all active monitors for a user
   */
  activeForUser(userId: string): QueryConstraint[] {
    return [where('user_id', '==', userId), where('isActive', '==', true)];
  },

  /**
   * Get monitors for a specific chat
   */
  forChat(userId: string, chatId: string): QueryConstraint[] {
    return [where('user_id', '==', userId), where('chat_id', '==', chatId)];
  },

  /**
   * Get monitors that are due for polling
   * Only returns active monitors with nextPollAt <= now
   */
  dueForPolling(now: number = Date.now()): QueryConstraint[] {
    return [where('isActive', '==', true), where('nextPollAt', '<=', now)];
  },

  /**
   * Get active monitors for a user, ordered by last update
   */
  recentlyUpdated(userId: string, count: number = 10): QueryConstraint[] {
    return [
      where('user_id', '==', userId),
      where('isActive', '==', true),
      orderBy('lastUpdatedAt', 'desc'),
      limit(count),
    ];
  },
};

/**
 * Helper: Create a new TradingMonitor record
 */
export function createNewMonitor(
  id: string,
  userId: string,
  chatId: string,
  symbol: string,
  timeframe: Timeframe,
  options?: {
    entry?: number;
    stopLoss?: number;
    takeProfit?: number;
  }
): TradingMonitor {
  const now = Date.now();
  return {
    id,
    user_id: userId,
    chat_id: chatId,
    symbol,
    timeframe,
    entry: options?.entry,
    stopLoss: options?.stopLoss,
    takeProfit: options?.takeProfit,
    isActive: true,
    startedAt: now,
    lastUpdatedAt: now,
    errorCount: 0,
  };
}

/**
 * Helper: Update monitor with new opinion data
 */
export function updateMonitorWithOpinion(
  monitor: TradingMonitor,
  action: string,
  confidence: number,
  nextPollAt: number
): TradingMonitor {
  return {
    ...monitor,
    lastAction: action as any,
    lastConfidence: confidence,
    lastUpdatedAt: Date.now(),
    lastFetchedAt: Date.now(),
    nextPollAt,
    errorCount: 0, // Reset error count on successful update
    error: undefined,
  };
}

/**
 * Helper: Update monitor with error
 */
export function updateMonitorWithError(
  monitor: TradingMonitor,
  error: string,
  nextPollAt: number,
  maxErrorsBeforePause: number = 3
): TradingMonitor {
  const newErrorCount = (monitor.errorCount ?? 0) + 1;
  return {
    ...monitor,
    errorCount: newErrorCount,
    error,
    lastUpdatedAt: Date.now(),
    nextPollAt,
    // Pause monitor after too many errors
    isActive: newErrorCount <= maxErrorsBeforePause,
  };
}

/**
 * Helper: Stop monitoring
 */
export function stopMonitor(monitor: TradingMonitor): TradingMonitor {
  return {
    ...monitor,
    isActive: false,
    lastUpdatedAt: Date.now(),
  };
}

/**
 * Helper: Resume monitoring
 */
export function resumeMonitor(monitor: TradingMonitor, nextPollAt: number = Date.now()): TradingMonitor {
  return {
    ...monitor,
    isActive: true,
    lastUpdatedAt: Date.now(),
    nextPollAt,
    errorCount: 0,
    error: undefined,
  };
}
