export type MariaReadinessSummary = {
  isReady: boolean;
  status: "Ready" | "Needs setup" | "Desktop bridge unavailable";
  note: string;
  issues: string[];
};

type MariaReadinessPayload = {
  ok?: unknown;
  issues?: unknown;
  shortcuts?: {
    dictation?: { registered?: unknown };
    command?: { registered?: unknown };
  };
  bridge?: {
    mainWindow?: unknown;
    overlayWindow?: unknown;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asPayload(value: unknown): MariaReadinessPayload | null {
  return isRecord(value) ? value : null;
}

function readIssues(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((issue): issue is string => typeof issue === "string" && issue.trim().length > 0);
}

function isRegistered(value: unknown) {
  return value === true;
}

export function summarizeMariaReadiness(value: unknown): MariaReadinessSummary {
  const payload = asPayload(value);

  if (!payload) {
    return {
      isReady: false,
      status: "Desktop bridge unavailable",
      note: "Open Maria in the desktop app to run commands.",
      issues: ["Desktop bridge unavailable."],
    };
  }

  const issues = readIssues(payload.issues);
  const bridgeAvailable = payload.bridge?.mainWindow === true || payload.bridge?.overlayWindow === true;
  const voiceShortcutReady = isRegistered(payload.shortcuts?.dictation?.registered);
  const screenShortcutReady = isRegistered(payload.shortcuts?.command?.registered);
  const isReady = payload.ok !== false && issues.length === 0 && bridgeAvailable;

  if (!bridgeAvailable) {
    return {
      isReady: false,
      status: "Desktop bridge unavailable",
      note: "Open Maria in the desktop app to run commands.",
      issues: issues.length > 0 ? issues : ["Desktop bridge unavailable."],
    };
  }

  if (!isReady) {
    return {
      isReady: false,
      status: "Needs setup",
      note: issues[0] || "Maria needs attention before every companion shortcut is available.",
      issues,
    };
  }

  if (!voiceShortcutReady || !screenShortcutReady) {
    return {
      isReady: true,
      status: "Ready",
      note: "Maria is ready near your cursor. One companion shortcut may be unavailable.",
      issues,
    };
  }

  return {
    isReady: true,
    status: "Ready",
    note: "Maria is ready near your cursor.",
    issues,
  };
}
