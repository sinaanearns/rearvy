export type AutomationStatus = "idle" | "planning" | "running" | "paused" | "stopped" | "error";
export type AutomationEventType = "system" | "plan" | "command" | "result" | "edit" | "error";

export type AutomationEvent = {
  id: string;
  type: AutomationEventType;
  title: string;
  detail: string;
  timestamp: number;
};

export type AutomationTask = {
  id: string;
  title: string;
  command: string;
  status: AutomationStatus;
  createdAt: number;
  updatedAt: number;
};

export type DesktopScopeMode = "folder" | "full-access" | "bypass";

export type DesktopScope = {
  mode: DesktopScopeMode;
  path: string;
};
