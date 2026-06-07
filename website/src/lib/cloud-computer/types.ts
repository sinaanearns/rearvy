import type {
  CloudComputerFile,
  CloudComputerSession,
  CloudComputerSessionStatus,
} from "@/lib/firebase/schema";

export const CLOUD_BROWSER_CONNECTION_METHOD = "cloud-browser" as const;

export type CloudBrowserConnectionMethod =
  typeof CLOUD_BROWSER_CONNECTION_METHOD;

export type BrowserSessionConnectionMethod =
  | "cdp-direct"
  | "extension-relay"
  | "managed-runner"
  | CloudBrowserConnectionMethod;

export type BrowserSessionConnectionMethodInput =
  | BrowserSessionConnectionMethod
  | "auto";

export type CloudComputerSerializedFile = {
  id: string;
  filename: string;
  type: CloudComputerFile["type"];
  contentType: string | null;
  size: number | null;
  downloadUrl: string | null;
  storagePath: string;
  browserbaseDownloadId: string | null;
  createdAt: string;
};

export type CloudComputerSerializedSession = {
  id: string;
  task: string;
  createdAt: number;
  createdAtIso: string;
  updatedAtIso: string;
  userId: string;
  provider: "browserbase";
  providerSessionId: string;
  connectionMethod: CloudBrowserConnectionMethod;
  connectionStatus: string | null;
  isRunning: boolean;
  status: CloudComputerSessionStatus;
  currentUrl: string | null;
  title: string | null;
  summary: string | null;
  setupError: string | null;
  screenshotDataUrl: string | null;
  screenshotUrl: string | null;
  liveViewUrl?: string | null;
  files: CloudComputerSerializedFile[];
  actionLog: Array<{
    id: string;
    action: string;
    status: string;
    message: string;
    timestamp: string;
  }>;
  exitCode: number | null;
  exitedAt: number | null;
};

export type CloudComputerStartOptions = {
  task: string;
  userId: string;
  dedupeKey?: string | null;
  strategy?: "goal-seeking" | "open-only";
};

export type CloudComputerCommandResult = {
  ok: true;
  session: CloudComputerSerializedSession;
  message?: string;
} | {
  ok: false;
  error: string;
  code?: number;
  status?: CloudComputerSessionStatus;
};

export const CLOUD_COMPUTER_LOGIN_REQUIRED_MESSAGE =
  "This cloud computer v1 cannot handle logins, CAPTCHA, payments, password entry, or 2FA. Ask the user for a public, non-authenticated path or handle the authenticated step outside v1.";

const LOGIN_REQUIRED_PATTERNS = [
  /\blog\s*in\b/i,
  /\blogin\b/i,
  /\bsign\s*in\b/i,
  /\bsignin\b/i,
  /\bsign\s*up\b/i,
  /\bpassword\b/i,
  /\bcredential/i,
  /\bcaptcha\b/i,
  /\b2fa\b/i,
  /\btwo[-\s]?factor\b/i,
  /\botp\b/i,
  /\bpayment\b/i,
  /\bcheckout\b/i,
  /\bcredit\s*card\b/i,
];

export function requiresUnsupportedCloudComputerAuth(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) return false;
  return LOGIN_REQUIRED_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function isCloudComputerRunningStatus(status: CloudComputerSessionStatus) {
  return status === "initializing" || status === "running" || status === "awaiting_user";
}

export function serializeCloudComputerFile(
  file: CloudComputerFile
): CloudComputerSerializedFile {
  return {
    id: file.id,
    filename: file.filename,
    type: file.type,
    contentType: file.content_type,
    size: file.size_bytes,
    downloadUrl: file.download_url,
    storagePath: file.storage_path,
    browserbaseDownloadId: file.browserbase_download_id,
    createdAt: file.created_at,
  };
}

export function serializeCloudComputerSession(
  session: CloudComputerSession,
  files: CloudComputerFile[] = [],
  liveViewUrl?: string | null
): CloudComputerSerializedSession {
  const createdAt = Date.parse(session.created_at);
  const stoppedAt = session.stopped_at ? Date.parse(session.stopped_at) : null;

  return {
    id: session.id,
    task: session.task,
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
    createdAtIso: session.created_at,
    updatedAtIso: session.updated_at,
    userId: session.user_id,
    provider: session.provider,
    providerSessionId: session.provider_session_id,
    connectionMethod: CLOUD_BROWSER_CONNECTION_METHOD,
    connectionStatus: session.error ? "error" : session.status,
    isRunning: isCloudComputerRunningStatus(session.status),
    status: session.status,
    currentUrl: session.current_url,
    title: session.title,
    summary: session.summary,
    setupError: session.error,
    screenshotDataUrl: null,
    screenshotUrl: session.screenshot_url,
    liveViewUrl,
    files: files.map(serializeCloudComputerFile),
    actionLog: [
      {
        id: `${session.id}-status`,
        action: "cloud-computer",
        status: session.status,
        message: session.summary || session.error || "Cloud computer session active.",
        timestamp: session.updated_at,
      },
    ],
    exitCode: session.status === "failed" ? 1 : session.status === "closed" ? 0 : null,
    exitedAt: Number.isFinite(stoppedAt ?? NaN) ? stoppedAt : null,
  };
}
