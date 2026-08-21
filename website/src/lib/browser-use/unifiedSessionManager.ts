import "server-only";

import {
  shouldPreferCloudComputer,
  isVercelRuntime,
} from "@/lib/cloud-computer/config";
import {
  getCloudComputerSessionForUser,
  listCloudComputerSessionsForUser,
  sendCloudComputerCommand,
  startCloudComputerSession,
  stopCloudComputerSession,
} from "@/lib/cloud-computer/service";
import {
  CLOUD_BROWSER_CONNECTION_METHOD,
  type BrowserSessionConnectionMethodInput,
} from "@/lib/cloud-computer/types";
import type { BrowserTaskStrategy } from "./goal-seeking";
import { readSession, type PersistedSession } from "./session-store";
import { isFirecrawlConfigured } from "@/lib/firecrawl/client";

type UnifiedCreateOptions = {
  connectionMethod?: BrowserSessionConnectionMethodInput;
  strategy?: BrowserTaskStrategy;
  dedupeKey?: string | null;
  /** When true, activate CloakBrowser stealth Chromium for this session. */
  stealthMode?: boolean;
  /** Optional HTTP or SOCKS5 proxy URL to route browser traffic through. */
  proxy?: string | null;
};

type UnifiedServiceResult =
  | {
      ok: true;
      id: string;
      reused?: boolean;
      status?: string;
      summary?: string | null;
      currentUrl?: string | null;
      title?: string | null;
      connectionMethod?: string;
      session?: unknown;
    }
  | {
      ok: false;
      error: string;
      code?: number;
      status?: string;
    };

const LOCAL_METHODS = ["cdp-direct", "extension-relay", "managed-runner", "firecrawl", "auto"] as const;

function isLocalMethod(value: unknown): value is (typeof LOCAL_METHODS)[number] {
  return typeof value === "string" && LOCAL_METHODS.includes(value as (typeof LOCAL_METHODS)[number]);
}

function isCloudSessionId(id: string) {
  return id.startsWith("cc_");
}

function isFirecrawlSessionId(id: string) {
  if (id.startsWith("fc_")) return true;
  try {
    const session = readSession(id);
    return session?.connectionMethod === "firecrawl";
  } catch {
    return false;
  }
}

export async function createUnifiedBrowserSession(
  task: string,
  userId: string,
  options: UnifiedCreateOptions = {}
): Promise<UnifiedServiceResult> {
  const requestedMethod = options.connectionMethod || "firecrawl";

  // When Firecrawl is configured, ALWAYS use Firecrawl Cloud Browser exclusively
  const useFirecrawl = isFirecrawlConfigured();

  if (useFirecrawl) {
    const { createFirecrawlInteractSession } = await import("@/lib/firecrawl/firecrawlSessionManager");
    const result = await createFirecrawlInteractSession(task, userId, {
      dedupeKey: options.dedupeKey,
    });
    if (result.ok) {
      return {
        ok: true,
        id: result.id,
        status: result.status,
        summary: null,
        currentUrl: null,
        title: null,
        connectionMethod: "firecrawl",
        session: { liveViewUrl: result.liveViewUrl, interactiveLiveViewUrl: result.interactiveLiveViewUrl },
      };
    }
    return {
      ok: false,
      error: result.error || "Firecrawl cloud browser session creation failed.",
    };
  }
  
  // Check if this is an explicit request for cloud browser
  const isExplicitCloudRequest = requestedMethod === "cloud-browser";
  
  // Determine if we should use cloud computer
  const useCloud = shouldPreferCloudComputer({
    requestedMethod,
    localAvailable: !process.env.VERCEL,
  });

  if (useCloud) {
    const result = await startCloudComputerSession({
      userId,
      task,
      strategy: options.strategy,
      skipFeatureFlagCheck: isExplicitCloudRequest, // Skip feature flag check for explicit requests
    });
    if (!result.ok) {
      return result;
    }

    return {
      ok: true,
      id: result.session.id,
      status: result.session.status,
      summary: result.session.summary,
      currentUrl: result.session.currentUrl,
      title: result.session.title,
      connectionMethod: CLOUD_BROWSER_CONNECTION_METHOD,
      session: result.session,
    };
  }

  if (!isLocalMethod(requestedMethod)) {
    return {
      ok: false,
      error: `Unsupported browser connection method: ${requestedMethod}`,
      code: 400,
    };
  }

  const local = await import("./sessionManager");
  const result = await local.createSession(task, userId, {
    connectionMethod: requestedMethod,
    strategy: options.strategy,
    dedupeKey: options.dedupeKey,
    stealthMode: options.stealthMode,
    proxy: options.proxy,
  });

  return result;
}

export async function listUnifiedBrowserSessions(userId: string) {
  const sessions = new Map<string, PersistedSession | unknown>();

  if (!process.env.VERCEL) {
    const local = await import("./sessionManager");
    const store = await import("./session-store");
    for (const session of store.listPersistedSessions()) {
      if (session.userId === userId) {
        sessions.set(session.id, session);
      }
    }
    for (const session of local.listSessions().map(local.serializeSession)) {
      if (session.userId === userId) {
        sessions.set(session.id, session);
      }
    }
  }

  const cloudSessions = await listCloudComputerSessionsForUser(userId).catch(() => []);
  for (const session of cloudSessions) {
    sessions.set(session.id, session);
  }

  return Array.from(sessions.values()).sort((left, right) => {
    const leftCreatedAt =
      typeof left === "object" && left && "createdAt" in left
        ? Number((left as { createdAt?: unknown }).createdAt)
        : 0;
    const rightCreatedAt =
      typeof right === "object" && right && "createdAt" in right
        ? Number((right as { createdAt?: unknown }).createdAt)
        : 0;
    return rightCreatedAt - leftCreatedAt;
  });
}

export async function getUnifiedBrowserSession(params: {
  sessionId: string;
  userId: string;
  includeLiveView?: boolean;
}) {
  if (isCloudSessionId(params.sessionId)) {
    return getCloudComputerSessionForUser(params);
  }

  const local = await import("./sessionManager");
  const session = local.getSession(params.sessionId);
  if (session) {
    if (session.userId !== params.userId) {
      return { ok: false, error: "Unauthorized.", code: 403 };
    }

    return { ok: true, session: local.serializeSession(session) };
  }

  const store = await import("./session-store");
  const persisted = store.readSession(params.sessionId);
  if (persisted) {
    if (persisted.userId && params.userId && persisted.userId !== params.userId) {
      return { ok: false, error: "Unauthorized.", code: 403 };
    }

    return { ok: true, session: persisted };
  }

  return { ok: false, error: "Session not found.", code: 404 };
}

export async function sendCommandToUnifiedBrowserSession(params: {
  sessionId: string;
  userId: string;
  command: string;
}) {
  if (isCloudSessionId(params.sessionId)) {
    return sendCloudComputerCommand(params);
  }

  if (isFirecrawlSessionId(params.sessionId)) {
    const { sendCommandToFirecrawlSession } = await import("@/lib/firecrawl/firecrawlSessionManager");
    const result = await sendCommandToFirecrawlSession(params.sessionId, params.command);
    return result;
  }

  const ownership = await getUnifiedBrowserSession({
    sessionId: params.sessionId,
    userId: params.userId,
  });
  if (!ownership.ok) return ownership;

  const local = await import("./sessionManager");
  return local.sendCommandToSession(params.sessionId, params.command);
}

export async function closeUnifiedBrowserSession(params: {
  sessionId: string;
  userId: string;
}) {
  if (isCloudSessionId(params.sessionId)) {
    return stopCloudComputerSession(params);
  }

  if (isFirecrawlSessionId(params.sessionId)) {
    const { closeFirecrawlSession } = await import("@/lib/firecrawl/firecrawlSessionManager");
    return closeFirecrawlSession(params.sessionId);
  }

  const ownership = await getUnifiedBrowserSession({
    sessionId: params.sessionId,
    userId: params.userId,
  });
  if (!ownership.ok) return ownership;

  const local = await import("./sessionManager");
  return local.closeSession(params.sessionId);
}
