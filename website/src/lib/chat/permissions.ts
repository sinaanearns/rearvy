export type ChatPermissionMode = "default" | "full-access";

export type DesktopWorkspaceScope = {
  mode: "folder" | "full-access";
  path: string;
};

export const CHAT_PERMISSION_MODE_STORAGE_KEY =
  "rearvy.chat-permission-mode.v1";

export const DEFAULT_DESKTOP_WORKSPACE_SCOPE: DesktopWorkspaceScope = {
  mode: "folder",
  path: "",
};

export function normalizeChatPermissionMode(
  value: unknown
): ChatPermissionMode {
  return value === "full-access" ? "full-access" : "default";
}

export function normalizeDesktopWorkspaceScope(
  value: unknown
): DesktopWorkspaceScope {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_DESKTOP_WORKSPACE_SCOPE;
  }

  const record = value as Record<string, unknown>;

  return {
    mode: record.mode === "full-access" ? "full-access" : "folder",
    path: typeof record.path === "string" ? record.path : "",
  };
}
