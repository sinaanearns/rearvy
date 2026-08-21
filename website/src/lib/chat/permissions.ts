export type ChatPermissionMode = "approval" | "full-access" | "default" | "bypass";

export type DesktopWorkspaceScope = {
  mode: "folder" | "full-access" | "bypass";
  path: string;
};

export const CHAT_PERMISSION_MODE_STORAGE_KEY =
  "rearvy.chat-permission-mode.v1";

export const DEFAULT_DESKTOP_WORKSPACE_SCOPE: DesktopWorkspaceScope = {
  mode: "folder",
  path: "",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeChatPermissionMode(
  value: unknown
): ChatPermissionMode {
  if (value === "full-access" || value === "bypass") {
    return "full-access";
  }
  return "approval";
}

export function normalizeDesktopWorkspaceScope(
  value: unknown
): DesktopWorkspaceScope {
  if (!isRecord(value)) {
    return DEFAULT_DESKTOP_WORKSPACE_SCOPE;
  }

  return {
    mode: value.mode === "full-access" ? "full-access" : value.mode === "bypass" ? "bypass" : "folder",
    path: typeof value.path === "string" ? value.path : "",
  };
}

export function loadStoredChatPermissionMode(): ChatPermissionMode {
  if (typeof window === "undefined") {
    return "approval";
  }

  try {
    const raw = window.localStorage.getItem(CHAT_PERMISSION_MODE_STORAGE_KEY);
    return normalizeChatPermissionMode(raw);
  } catch {
    return "approval";
  }
}

export function saveStoredChatPermissionMode(mode: ChatPermissionMode): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      CHAT_PERMISSION_MODE_STORAGE_KEY,
      normalizeChatPermissionMode(mode)
    );
  } catch {
    // Ignore storage write errors (e.g. private browsing storage restriction)
  }
}


