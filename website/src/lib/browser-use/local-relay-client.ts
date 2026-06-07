import type { BrowserConnectionMethod } from "@/lib/chat/browser-connection-rendering";

export type LocalRelayInfo = {
  ok?: boolean;
  port?: number;
  extensionPath?: string;
  extensionId?: string | null;
  extensionOptionsUrl?: string | null;
  relaySetupUrl?: string | null;
  pairingCode?: string | null;
  error?: string;
};

export type LocalBrowserConnectionStatus = {
  cdpDirect?: {
    connected?: boolean;
    browser?: string;
    version?: string;
    webSocketDebuggerUrl?: string;
    error?: string;
  };
  extensionRelay?: {
    connected?: boolean;
    active?: boolean;
    trusted?: boolean;
    stale?: boolean;
    extensionId?: string | null;
    version?: string | null;
    tabCount?: number;
    lastSeenAt?: string | null;
    pairingCode?: string | null;
    error?: string;
  };
  recommendedMethod?: BrowserConnectionMethod;
};

export type LocalRelayBrowserBridge = {
  getConnectionStatus: () => Promise<LocalBrowserConnectionStatus>;
  openExtensionOptions: (options?: {
    pairingCode?: string;
    relayUrl?: string;
  }) => Promise<unknown>;
  createRelayPairingCode: () => Promise<{
    ok?: boolean;
    pairingCode?: string;
    port?: number;
    error?: string;
  }>;
  getRelayInfo: () => Promise<LocalRelayInfo>;
};

const DEFAULT_RELAY_PORT = 48732;
const LOCAL_RELAY_TIMEOUT_MS = 1200;

type LocationLike = Pick<Location, "hostname" | "protocol">;

type LocalRelayBridgeOptions = {
  location?: LocationLike | null;
  fetchImpl?: typeof fetch;
  openWindow?: Window["open"];
  relayPort?: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return undefined;
}

function normalizePort(value: unknown, fallback = DEFAULT_RELAY_PORT) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed < 65536
    ? parsed
    : fallback;
}

function configuredRelayPort() {
  return normalizePort(
    process.env.NEXT_PUBLIC_REARVY_BROWSER_RELAY_PORT,
    DEFAULT_RELAY_PORT
  );
}

export function isLocalRearvyHost(hostname: string) {
  const normalized = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");

  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "127.0.0.1" ||
    normalized === "0.0.0.0" ||
    normalized === "::1"
  );
}

export function canUseLocalRelayBridge(location: LocationLike | null | undefined) {
  if (!location) {
    return false;
  }

  return (
    (location.protocol === "http:" || location.protocol === "https:") &&
    isLocalRearvyHost(location.hostname)
  );
}

export function getLocalRelayBaseUrl(port = configuredRelayPort()) {
  return `http://127.0.0.1:${normalizePort(port)}`;
}

export function buildLocalRelaySetupUrl(
  baseUrl: string,
  options: { pairingCode?: string | null; relayUrl?: string | null } = {}
) {
  const url = new URL("/browser-relay/setup", baseUrl);
  const pairingCode = firstString(options.pairingCode).toUpperCase();
  const relayUrl = firstString(options.relayUrl, baseUrl);

  if (pairingCode) {
    url.searchParams.set("pairingCode", pairingCode);
  }

  if (relayUrl) {
    url.searchParams.set("relayUrl", relayUrl);
  }

  return url.toString();
}

function relayUnavailableStatus(error: unknown, baseUrl: string): LocalBrowserConnectionStatus {
  const detail = error instanceof Error ? error.message : String(error);
  const message = `Start Rearvy Desktop to enable the local browser relay at ${baseUrl}.`;

  return {
    cdpDirect: {
      connected: false,
      error: "CDP Direct requires Rearvy Desktop.",
    },
    extensionRelay: {
      connected: false,
      error: detail && detail !== "TypeError: Failed to fetch" ? `${message} ${detail}` : message,
    },
    recommendedMethod: "extension-relay",
  };
}

async function fetchRelayJson(
  fetchImpl: typeof fetch,
  baseUrl: string,
  path: string,
  init: RequestInit = {}
) {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    LOCAL_RELAY_TIMEOUT_MS
  );

  try {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const record = asRecord(payload);
      throw new Error(
        firstString(record?.error, record?.reason) || `Relay returned HTTP ${response.status}`
      );
    }
    return payload;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

function normalizeConnectionStatus(
  payload: unknown,
  fallbackPort: number
): LocalBrowserConnectionStatus {
  const record = asRecord(payload);
  const extension = asRecord(record?.extension);
  const port = normalizePort(firstNumber(record?.port), fallbackPort);
  const connected = record?.connected === true || extension?.connected === true;

  return {
    cdpDirect: {
      connected: false,
      error: "CDP Direct requires Rearvy Desktop.",
    },
    extensionRelay: {
      connected,
      active: record?.active === true || extension?.active === true,
      trusted: record?.trusted === true || extension?.trusted === true,
      stale: record?.stale === true || extension?.stale === true,
      extensionId: firstString(extension?.id, extension?.knownId, record?.extensionId) || null,
      version: firstString(extension?.version, record?.version) || null,
      tabCount: firstNumber(extension?.tabCount, record?.tabCount),
      lastSeenAt: firstString(extension?.lastSeenAt, record?.lastSeenAt) || null,
      pairingCode: firstString(record?.pairingCode) || null,
    },
    recommendedMethod: "extension-relay",
  };
}

function normalizeRelayInfo(
  payload: unknown,
  baseUrl: string,
  fallbackPort: number
): LocalRelayInfo {
  const record = asRecord(payload);
  const extension = asRecord(record?.extension);
  const port = normalizePort(firstNumber(record?.port), fallbackPort);
  const pairingCode = firstString(record?.pairingCode) || null;
  const relayUrl = getLocalRelayBaseUrl(port);

  return {
    ok: true,
    port,
    extensionPath: firstString(record?.extensionPath) || undefined,
    extensionId: firstString(extension?.id, extension?.knownId, record?.extensionId) || null,
    extensionOptionsUrl:
      firstString(extension?.optionsUrl, record?.extensionOptionsUrl) || null,
    relaySetupUrl: buildLocalRelaySetupUrl(baseUrl, {
      pairingCode,
      relayUrl,
    }),
    pairingCode,
  };
}

function normalizePairingCodeResponse(
  payload: unknown,
  fallbackPort: number
): { ok?: boolean; pairingCode?: string; port?: number; error?: string } {
  const record = asRecord(payload);
  if (!record) {
    return {
      ok: false,
      port: fallbackPort,
      error: "Relay pairing response was not a JSON object.",
    };
  }

  return {
    ok: record.ok === true,
    pairingCode: firstString(record.pairingCode) || undefined,
    port: normalizePort(firstNumber(record.port), fallbackPort),
    error: firstString(record.error, record.reason) || undefined,
  };
}

export function createLocalRelayBrowserBridge(
  options: LocalRelayBridgeOptions = {}
): LocalRelayBrowserBridge | null {
  const location =
    options.location ??
    (typeof window !== "undefined" ? window.location : null);

  if (!canUseLocalRelayBridge(location)) {
    return null;
  }

  const fetchImpl =
    options.fetchImpl ??
    (typeof fetch === "function" ? fetch.bind(globalThis) : null);

  if (!fetchImpl) {
    return null;
  }

  const port = normalizePort(options.relayPort, configuredRelayPort());
  const baseUrl = getLocalRelayBaseUrl(port);
  const openWindow =
    options.openWindow ??
    (typeof window !== "undefined" ? window.open.bind(window) : null);

  return {
    async getConnectionStatus() {
      try {
        const payload = await fetchRelayJson(fetchImpl, baseUrl, "/status");
        return normalizeConnectionStatus(payload, port);
      } catch (error) {
        return relayUnavailableStatus(error, baseUrl);
      }
    },
    async createRelayPairingCode() {
      const payload = await fetchRelayJson(fetchImpl, baseUrl, "/pairing-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      return normalizePairingCodeResponse(payload, port);
    },
    async getRelayInfo() {
      try {
        const payload = await fetchRelayJson(fetchImpl, baseUrl, "/status");
        return normalizeRelayInfo(payload, baseUrl, port);
      } catch (error) {
        return {
          ok: false,
          port,
          relaySetupUrl: buildLocalRelaySetupUrl(baseUrl),
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
    async openExtensionOptions(options = {}) {
      if (!openWindow) {
        throw new Error("Opening the local browser relay setup page is unavailable.");
      }

      const setupUrl = buildLocalRelaySetupUrl(baseUrl, {
        pairingCode: options.pairingCode,
        relayUrl: options.relayUrl || baseUrl,
      });
      openWindow(setupUrl, "_blank", "noopener,noreferrer");
      return {
        ok: true,
        fallback: true,
        setupUrl,
        url: setupUrl,
      };
    },
  };
}
