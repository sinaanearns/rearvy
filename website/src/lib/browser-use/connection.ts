export type BrowserConnectionMethod =
  | "cdp-direct"
  | "extension-relay"
  | "managed-runner";

export type CdpProbeResult = {
  connected: boolean;
  method: "cdp-direct";
  port: number;
  browser?: string;
  protocolVersion?: string;
  webSocketDebuggerUrl?: string;
  error?: string;
};

export type ExtensionRelayStatus = {
  connected: boolean;
  method: "extension-relay";
  port: number;
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

export type BrowserConnectionStatus = {
  cdpDirect: CdpProbeResult;
  extensionRelay: ExtensionRelayStatus;
  recommendedMethod: BrowserConnectionMethod;
};

const DEFAULT_CDP_PORT = 9222;
const DEFAULT_RELAY_PORT = 48732;

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

function parsePort(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed < 65536
    ? parsed
    : fallback;
}

export function getCdpPort() {
  return parsePort(process.env.REARVY_BROWSER_CDP_PORT, DEFAULT_CDP_PORT);
}

export function getBrowserRelayPort() {
  return parsePort(
    process.env.REARVY_BROWSER_RELAY_PORT,
    DEFAULT_RELAY_PORT
  );
}

export function normalizeCdpProbeResponse(
  payload: unknown,
  port = getCdpPort()
): CdpProbeResult {
  const record = asRecord(payload);
  if (!record) {
    return {
      connected: false,
      method: "cdp-direct",
      port,
      error: "Browser remote debugging did not return a JSON object.",
    };
  }

  const browser = firstString(record.Browser, record.browser);
  const webSocketDebuggerUrl = firstString(
    record.webSocketDebuggerUrl,
    record.webSocketDebuggerURL
  );

  return {
    connected: Boolean(browser || webSocketDebuggerUrl),
    method: "cdp-direct",
    port,
    browser: browser || undefined,
    protocolVersion: firstString(record["Protocol-Version"]) || undefined,
    webSocketDebuggerUrl: webSocketDebuggerUrl || undefined,
  };
}

export function normalizeExtensionRelayStatus(
  payload: unknown,
  port = getBrowserRelayPort()
): ExtensionRelayStatus {
  const record = asRecord(payload);
  if (!record) {
    return {
      connected: false,
      method: "extension-relay",
      port,
      error: "Browser relay did not return a JSON object.",
    };
  }

  const extension = asRecord(record.extension);
  return {
    connected: record.connected === true || extension?.connected === true,
    method: "extension-relay",
    port,
    active: record.active === true || extension?.active === true,
    trusted: record.trusted === true || extension?.trusted === true,
    stale: record.stale === true || extension?.stale === true,
    extensionId: firstString(extension?.id, record.extensionId) || null,
    version: firstString(extension?.version, record.version) || null,
    tabCount:
      typeof record.tabCount === "number"
        ? record.tabCount
        : typeof extension?.tabCount === "number"
          ? extension.tabCount
          : undefined,
    lastSeenAt: firstString(extension?.lastSeenAt, record.lastSeenAt) || null,
    pairingCode: firstString(record.pairingCode) || null,
  };
}

async function fetchJson(url: string, timeoutMs = 1200): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    try {
      return await response.json();
    } catch {
      throw new Error("Response was not valid JSON");
    }
  } finally {
    clearTimeout(timeout);
  }
}

export async function probeCdpDirect(
  port = getCdpPort()
): Promise<CdpProbeResult> {
  try {
    const payload = await fetchJson(`http://127.0.0.1:${port}/json/version`);
    return normalizeCdpProbeResponse(payload, port);
  } catch (error) {
    return {
      connected: false,
      method: "cdp-direct",
      port,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function probeExtensionRelay(
  port = getBrowserRelayPort()
): Promise<ExtensionRelayStatus> {
  try {
    const payload = await fetchJson(`http://127.0.0.1:${port}/status`);
    return normalizeExtensionRelayStatus(payload, port);
  } catch (error) {
    return {
      connected: false,
      method: "extension-relay",
      port,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function chooseBrowserConnectionMethod(params: {
  cdpDirect?: Pick<CdpProbeResult, "connected"> | null;
  extensionRelay?: Pick<ExtensionRelayStatus, "connected"> | null;
  allowedMethods?: BrowserConnectionMethod[];
  requireFunctionalControl?: boolean;
}): BrowserConnectionMethod {
  const allowed = new Set(
    params.allowedMethods?.length
      ? params.allowedMethods
      : (["cdp-direct", "extension-relay", "managed-runner"] as const)
  );

  if (allowed.has("cdp-direct") && params.cdpDirect?.connected) {
    return "cdp-direct";
  }

  if (
    allowed.has("extension-relay") &&
    params.extensionRelay?.connected &&
    params.requireFunctionalControl !== false
  ) {
    return "extension-relay";
  }

  if (allowed.has("managed-runner")) {
    return "managed-runner";
  }

  return allowed.has("extension-relay") ? "extension-relay" : "cdp-direct";
}

export async function getBrowserConnectionStatus(): Promise<BrowserConnectionStatus> {
  const [cdpDirect, extensionRelay] = await Promise.all([
    probeCdpDirect(),
    probeExtensionRelay(),
  ]);

  return {
    cdpDirect,
    extensionRelay,
    recommendedMethod: chooseBrowserConnectionMethod({
      cdpDirect,
      extensionRelay,
    }),
  };
}
