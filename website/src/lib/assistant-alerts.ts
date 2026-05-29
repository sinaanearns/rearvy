export type AssistantAlertSeverity = "info" | "warning" | "success";

export type AssistantAlertRecord = {
  id: string;
  user_id: string;
  chat_id: string | null;
  project_id: string | null;
  message_id: string | null;
  title: string;
  summary: string;
  message_text: string;
  severity: AssistantAlertSeverity;
  source: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AssistantAlertInput = {
  chatId?: string;
  projectId?: string | null;
  title: string;
  summary: string;
  messageText: string;
  severity?: AssistantAlertSeverity;
  source?: string;
};

export type AssistantAlertViewModel = {
  id: string;
  title: string;
  summary: string;
  severity: AssistantAlertSeverity;
  href: string;
  chatId: string | null;
  projectId: string | null;
  messageId: string | null;
  isRead: boolean;
  timeLabel: string;
};

export function clampAssistantMessage(text: string, maxLength = 220) {
  const normalized = text.trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

export function buildAssistantAlertHref(alert: {
  chat_id?: string | null;
  chatId?: string | null;
  project_id?: string | null;
  projectId?: string | null;
}) {
  const chatId = alert.chat_id ?? alert.chatId ?? null;
  const projectId = alert.project_id ?? alert.projectId ?? null;

  if (!chatId) {
    return "/chat/new?fresh=true";
  }

  return projectId ? `/projects/${projectId}/chat/${chatId}` : `/chat/${chatId}`;
}

export function formatAssistantAlertTime(createdAt: string) {
  const timestamp = new Date(createdAt).getTime();

  if (!Number.isFinite(timestamp)) {
    return "just now";
  }

  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function mapAssistantAlertToViewModel(
  alert: AssistantAlertRecord
): AssistantAlertViewModel {
  return {
    id: alert.id,
    title: alert.title,
    summary: alert.summary,
    severity: alert.severity,
    href: buildAssistantAlertHref(alert),
    chatId: alert.chat_id,
    projectId: alert.project_id,
    messageId: alert.message_id,
    isRead: alert.is_read,
    timeLabel: formatAssistantAlertTime(alert.created_at),
  };
}

const PROACTIVE_ALERT_PATTERN = /\b(urgent|attention|important|issue|problem|risk|warning|heads up|please check|look after|needs review|needs attention|security|incident|fighting)\b/i;

export function shouldCreateProactiveAssistantAlert(text: string) {
  const normalized = text.trim();

  if (normalized.length < 40) {
    return false;
  }

  return PROACTIVE_ALERT_PATTERN.test(normalized);
}

export function buildProactiveAssistantAlert(text: string) {
  const messageText = clampAssistantMessage(text, 220);
  const summary = clampAssistantMessage(text.replace(/\s+/g, " "), 140);

  return {
    title: "Rearvy wants your attention",
    summary,
    messageText,
    severity: "warning" as const,
    source: "model-proactive",
  };
}
