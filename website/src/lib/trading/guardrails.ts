/**
 * Trading Guardrails & Safety Enforcement
 * Per-user limits, cooldowns, audit logging, and safety checks
 */

import { Firestore, collection, query, where, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { DEFAULT_GUARDRAILS } from '@/lib/trading/opinion-engine';
import { TradingAuditLog, GuardailConfig } from '@/types/trading';
import { createServerLogger } from '@/lib/server-logger';

const log = createServerLogger('TradingGuardrails');

/**
 * Check if user can create a new monitor
 * Enforces per-user limit (default 3 active monitors)
 *
 * @returns { canMonitor: boolean, activeCount: number, limit: number }
 */
export async function enforcePerUserLimits(
  db: Firestore,
  userId: string,
  config: GuardailConfig = DEFAULT_GUARDRAILS
): Promise<{ canMonitor: boolean; activeCount: number; limit: number }> {
  try {
    const monitorsRef = collection(db, `users/${userId}/trading_monitors`);
    const q = query(monitorsRef, where('isActive', '==', true));
    const snapshot = await getDocs(q);

    const activeCount = snapshot.size;
    const canMonitor = activeCount < config.maxMonitorsPerUser;

    return {
      canMonitor,
      activeCount,
      limit: config.maxMonitorsPerUser,
    };
  } catch (error) {
    log.error('Error checking limits:', error);
    // On error, assume user can't monitor (conservative)
    return { canMonitor: false, activeCount: 0, limit: config.maxMonitorsPerUser };
  }
}

/**
 * Check if opinion update should be throttled due to cooldown
 * Prevents rapid opinion changes for the same symbol
 *
 * @returns { shouldThrottle: boolean, secondsUntilAvailable: number }
 */
export function enforceOpinionCooldown(
  lastOpinionAt: number | undefined,
  config: GuardailConfig = DEFAULT_GUARDRAILS
): { shouldThrottle: boolean; secondsUntilAvailable: number } {
  if (!lastOpinionAt) {
    return { shouldThrottle: false, secondsUntilAvailable: 0 };
  }

  const now = Date.now();
  const minIntervalMs = config.minPollingIntervalMs;
  const timeSinceLastOpinion = now - lastOpinionAt;

  if (timeSinceLastOpinion < minIntervalMs) {
    const secondsUntilAvailable = Math.ceil((minIntervalMs - timeSinceLastOpinion) / 1000);
    return { shouldThrottle: true, secondsUntilAvailable };
  }

  return { shouldThrottle: false, secondsUntilAvailable: 0 };
}

/**
 * Log a trading action for compliance and audit purposes
 * Maintains history of all opinions and monitor events
 */
export async function logTradingAction(
  db: Firestore,
  entry: Omit<TradingAuditLog, 'id' | 'timestamp'>
): Promise<string> {
  try {
    const auditLog: TradingAuditLog = {
      id: 'temp-id', // Will be replaced by Firestore doc ID
      ...entry,
      timestamp: Date.now(),
    };

    // Store in the global audit log for compliance review.
    const auditRef = collection(db, 'trading_audit_log');
    const docRef = await addDoc(auditRef, {
      ...auditLog,
      timestamp: Timestamp.now(),
    });

    // Also store in user-scoped audit log for faster queries
    const userAuditRef = collection(db, `users/${entry.user_id}/trading_audit_log`);
    await addDoc(userAuditRef, {
      ...auditLog,
      timestamp: Timestamp.now(),
    });

    return docRef.id;
  } catch (error) {
    log.error('Error logging trading action:', error);
    // Non-critical; don't throw
    return '';
  }
}

/**
 * Validate that opinion reasoning doesn't contain prohibited language
 * Checks for profit guarantees and misleading claims
 */
export function validateOpinionText(reason: string): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  // Patterns to detect profit promises
  const patterns = [
    { regex: /\byou will make money\b/i, message: 'Cannot promise profits' },
    { regex: /\bguaranteed\s+profit\b/i, message: 'Guaranteed profits not allowed' },
    { regex: /\bsafe\s+trade\b/i, message: 'Cannot claim trades are safe' },
    { regex: /\bcertain\s+profit\b/i, message: 'Certainty claims not allowed' },
    { regex: /\bno risk\b/i, message: 'Cannot claim zero risk' },
    { regex: /\byou\s+will\s+profit\b/i, message: 'Cannot promise profitability' },
  ];

  for (const { regex, message } of patterns) {
    if (regex.test(reason)) {
      violations.push(message);
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Create a safe warning message when opinion cannot be generated
 * Used when data is stale, missing, or insufficient
 */
export function createSafetyMessage(reason: 'stale_data' | 'missing_data' | 'api_error' | 'internal_error'): string {
  const messages = {
    stale_data: 'Market data is out of date (>1 hour old). Recommend holding until fresh data is available. No new trade recommendation.',
    missing_data: 'Required market data is missing. Cannot generate a reliable opinion. Recommend Hold.',
    api_error: 'Market data provider temporarily unavailable. Recommend Hold. Try again in a few minutes.',
    internal_error: 'Internal error processing opinion. Recommend Hold while we investigate.',
  };

  return messages[reason];
}

/**
 * Check if monitor error count suggests pausing monitoring
 */
export function shouldPauseMonitor(
  errorCount: number,
  threshold: number = DEFAULT_GUARDRAILS.maxErrorCountBeforePause
): boolean {
  return errorCount >= threshold;
}

/**
 * Format guardrail config for user display
 */
export function formatGuardrailsForDisplay(config: GuardailConfig): string {
  return `
**Trading Guardrails Enforced:**
- Max ${config.maxMonitorsPerUser} active monitors per user
- Minimum ${config.minPollingIntervalMs / 1000}s between opinion updates
- Confidence change threshold: ${config.confidenceThresholdForUpdate * 100}%
- Data staleness threshold: ${config.stalePlanetDataThresholdMs / 60000} minutes
- Max ${config.maxErrorCountBeforePause} consecutive errors before pause
- Audit logs retained for ${config.auditLogRetentionDays} days

These limits protect against runaway costs and ensure responsible AI trading recommendations.
  `.trim();
}
