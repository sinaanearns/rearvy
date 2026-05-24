"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  mapAssistantAlertToViewModel,
  type AssistantAlertRecord,
  type AssistantAlertViewModel,
} from "@/lib/assistant-alerts";

export function useAssistantAlerts() {
  const { user, loading } = useAuth();
  const [alerts, setAlerts] = useState<AssistantAlertViewModel[]>([]);

  useEffect(() => {
    if (loading || !user) {
      setAlerts([]);
      return;
    }

    let active = true;
    let currentController: AbortController | null = null;

    const loadAlerts = async () => {
      currentController?.abort();
      const controller = new AbortController();
      currentController = controller;

      try {
        const token = await user.getIdToken();
        if (!token || !active || controller.signal.aborted) {
          return;
        }

        const response = await fetch("/api/assistant/alerts?limit=10", {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to load assistant alerts");
        }

        const data = (await response.json()) as {
          ok?: boolean;
          alerts?: AssistantAlertRecord[];
        };

        if (!active) {
          return;
        }

        setAlerts((data.alerts || []).map(mapAssistantAlertToViewModel));
      } catch (error) {
        if (!active || controller.signal.aborted) {
          return;
        }

        console.error("Failed to fetch assistant alerts:", error);
        setAlerts([]);
      }
    };

    void loadAlerts();
    const interval = window.setInterval(() => {
      void loadAlerts();
    }, 45_000);

    return () => {
      active = false;
      currentController?.abort();
      window.clearInterval(interval);
    };
  }, [loading, user]);

  const unreadCount = useMemo(
    () => alerts.filter((alert) => !alert.isRead).length,
    [alerts]
  );

  const markAlertRead = async (alertId: string, nextIsRead = true) => {
    setAlerts((current) =>
      current.map((alert) =>
        alert.id === alertId ? { ...alert, isRead: nextIsRead } : alert
      )
    );

    if (!user) {
      return;
    }

    try {
      const token = await user.getIdToken();
      if (!token) {
        return;
      }

      await fetch("/api/assistant/alerts", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: alertId, isRead: nextIsRead }),
      });
    } catch (error) {
      console.error("Failed to mark assistant alert read:", error);
    }
  };

  const markAllRead = async () => {
    const unreadAlerts = alerts.filter((alert) => !alert.isRead);
    if (unreadAlerts.length === 0) {
      return;
    }

    setAlerts((current) => current.map((alert) => ({ ...alert, isRead: true })));

    await Promise.all(unreadAlerts.map((alert) => markAlertRead(alert.id, true)));
  };

  return {
    alerts,
    unreadCount,
    markAlertRead,
    markAllRead,
  };
}
