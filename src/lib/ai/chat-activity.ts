export type ChatActivityStatus =
  | "pending"
  | "running"
  | "complete"
  | "error"
  | "info";

export type ChatActivityKind =
  | "analysis"
  | "context"
  | "model"
  | "tool"
  | "provider"
  | "memory"
  | "web"
  | "storage";

export type ChatActivityData = {
  id: string;
  title: string;
  status: ChatActivityStatus;
  detail?: string;
  kind?: ChatActivityKind;
  at?: string;
};

export type ChatActivityPart = {
  type: "data-activity";
  id?: string;
  data: ChatActivityData;
};

export function isChatActivityPart(value: unknown): value is ChatActivityPart {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const part = value as Record<string, unknown>;
  if (part.type !== "data-activity") {
    return false;
  }

  const data = part.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return false;
  }

  const record = data as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.title === "string" &&
    typeof record.status === "string"
  );
}
