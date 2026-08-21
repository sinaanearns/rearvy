"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  mapAssistantAlertToViewModel,
  type AssistantAlertRecord,
  type AssistantAlertViewModel,
} from "@/lib/assistant-alerts";
import { createClientLogger } from "@/lib/client-diagnostics";
import { getErrorMessage } from "@/lib/error-utils";

const log = createClientLogger("AssistantAlerts");

type AssistantAlertsResponse = {
  alerts?: unknown;
  error?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isAssistantAlertRecord(value: unknown): value is AssistantAlertRecord {
  if (!isRecord(value)) {
    return false;
  }

  const severity = value.severity;
  return (
    typeof value.id === "string" &&
    typeof value.user_id === "string" &&
    (typeof value.chat_id === "string" || value.chat_id === null) &&
    (typeof value.project_id === "string" || value.project_id === null) &&
    (typeof value.message_id === "string" || value.message_id === null) &&
    typeof value.title === "string" &&
    typeof value.summary === "string" &&
    typeof value.message_text === "string" &&
    (severity === "info" || severity === "warning" || severity === "success") &&
    typeof value.source === "string" &&
    typeof value.is_read === "boolean" &&
    (typeof value.read_at === "string" || value.read_at === null) &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string"
  );
}

async function readAssistantAlertsResponse(response: Response): Promise<AssistantAlertsResponse> {
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!isRecord(payload)) {
    return {};
  }

  return {
    alerts: payload.alerts,
    error: payload.error,
  };
}

function getResponseError(payload: { error?: unknown }, fallback: string) {
  return typeof payload.error === "string" && payload.error.trim() ? payload.error : fallback;
}

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

        const data = await readAssistantAlertsResponse(response);

        if (!active) {
          return;
        }

        if (!response.ok) {
          throw new Error(getResponseError(data, "Failed to load assistant alerts"));
        }

        const nextAlerts = Array.isArray(data.alerts)
          ? data.alerts.filter(isAssistantAlertRecord).map(mapAssistantAlertToViewModel)
          : [];
        setAlerts(nextAlerts);
      } catch (error) {
        if (!active || controller.signal.aborted) {
          return;
        }

        log.error("Failed to fetch assistant alerts:", error);
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

      const response = await fetch("/api/assistant/alerts", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: alertId, isRead: nextIsRead }),
      });

      if (!response.ok) {
        const data = await readAssistantAlertsResponse(response);
        throw new Error(getResponseError(data, "Failed to update assistant alert"));
      }
    } catch (error) {
      log.error("Failed to mark assistant alert read:", error);
      setAlerts((current) =>
        current.map((alert) =>
          alert.id === alertId ? { ...alert, isRead: !nextIsRead } : alert
        )
      );
      if (getErrorMessage(error, "")) {
        log.warn("Assistant alert read status was rolled back.");
      }
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
