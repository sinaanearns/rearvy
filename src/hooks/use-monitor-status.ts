/**
 * Hook: useMonitorStatus
 * Polls for monitor status changes from the server
 * Updates UI badges in real-time as monitors are created/stopped
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { TradingMonitor } from '@/types/trading';

export interface MonitorStatusMap {
  [monitorId: string]: 'active' | 'inactive' | 'error' | undefined;
}

interface UseMonitorStatusOptions {
  chatId?: string;
  pollIntervalMs?: number; // Default 5-10 seconds
  enabled?: boolean; // Can disable polling
}

/**
 * Hook to poll and track monitor statuses for a chat
 * Returns a map of monitorId -> status and helper functions
 */
export function useMonitorStatus(
  userId: string | undefined,
  options: UseMonitorStatusOptions = {}
) {
  const {
    chatId,
    pollIntervalMs = 7000, // 7 seconds default
    enabled = true,
  } = options;

  const [statusMap, setStatusMap] = useState<MonitorStatusMap>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch current monitor statuses
  const fetchMonitorStatuses = useCallback(async () => {
    if (!userId || !chatId) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `/api/trading/monitors?chatId=${encodeURIComponent(chatId)}&activeOnly=false`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch monitors: ${response.statusText}`);
      }

      const data = await response.json();
      const monitors: TradingMonitor[] = data.monitors || [];

      // Build status map
      const newStatusMap: MonitorStatusMap = {};
      for (const monitor of monitors) {
        const status: 'active' | 'inactive' | 'error' =
          monitor.errorCount && monitor.errorCount > 3
            ? 'error'
            : monitor.isActive
              ? 'active'
              : 'inactive';

        newStatusMap[monitor.id] = status;
      }

      setStatusMap(newStatusMap);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      console.error('Error fetching monitor statuses:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, chatId]);

  // Start polling effect
  useEffect(() => {
    if (!enabled || !userId || !chatId) {
      return;
    }

    // Fetch immediately on mount
    fetchMonitorStatuses();

    // Set up polling interval
    const interval = setInterval(fetchMonitorStatuses, pollIntervalMs);

    return () => clearInterval(interval);
  }, [enabled, userId, chatId, pollIntervalMs, fetchMonitorStatuses]);

  // Helper to start monitoring
  const startMonitoring = useCallback(
    async (monitorData: {
      symbol: string;
      timeframe: string;
      entry?: number;
      stopLoss?: number;
      takeProfit?: number;
    }) => {
      if (!chatId) {
        throw new Error('No chatId provided');
      }

      try {
        const response = await fetch('/api/trading/monitors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId,
            ...monitorData,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || `Failed to start monitor: ${response.statusText}`);
        }

        const data = await response.json();
        const monitorId = data.monitorId;

        // Update local state
        setStatusMap(prev => ({
          ...prev,
          [monitorId]: 'active',
        }));

        // Refresh full list
        await fetchMonitorStatuses();

        return monitorId;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to start monitor';
        setError(errorMsg);
        throw err;
      }
    },
    [chatId, fetchMonitorStatuses]
  );

  // Helper to stop monitoring
  const stopMonitoring = useCallback(
    async (monitorId: string) => {
      try {
        const response = await fetch(`/api/trading/monitors/${monitorId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: false }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || `Failed to stop monitor: ${response.statusText}`);
        }

        // Update local state
        setStatusMap(prev => ({
          ...prev,
          [monitorId]: 'inactive',
        }));

        // Refresh full list
        await fetchMonitorStatuses();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to stop monitor';
        setError(errorMsg);
        throw err;
      }
    },
    [fetchMonitorStatuses]
  );

  // Helper to resume monitoring
  const resumeMonitoring = useCallback(
    async (monitorId: string) => {
      try {
        const response = await fetch(`/api/trading/monitors/${monitorId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: true }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || `Failed to resume monitor: ${response.statusText}`);
        }

        // Update local state
        setStatusMap(prev => ({
          ...prev,
          [monitorId]: 'active',
        }));

        // Refresh full list
        await fetchMonitorStatuses();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to resume monitor';
        setError(errorMsg);
        throw err;
      }
    },
    [fetchMonitorStatuses]
  );

  // Get status for a specific monitor
  const getStatus = useCallback(
    (monitorId: string) => statusMap[monitorId],
    [statusMap]
  );

  return {
    statusMap,
    isLoading,
    error,
    getStatus,
    startMonitoring,
    stopMonitoring,
    resumeMonitoring,
    refetch: fetchMonitorStatuses,
  };
}
