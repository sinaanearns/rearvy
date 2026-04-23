import {
  buildBrowserWebSocketUrl,
  type BrowserSessionSnapshot,
} from "./shared";

type BrowserNetworkContext = {
  protocol?: string | null;
  hostname?: string | null;
};

function sanitizeHostname(hostname: string | null | undefined) {
  if (!hostname) {
    return null;
  }

  return hostname.replace(/:\d+$/, "").trim() || null;
}

export function serializeLiveBrowserSession(
  session: BrowserSessionSnapshot,
  networkContext: BrowserNetworkContext = {}
) {
  const hostname = sanitizeHostname(networkContext.hostname);
  const websocketUrl = hostname
    ? buildBrowserWebSocketUrl({
        port: session.streamPort,
        sessionId: session.sessionId,
        streamToken: session.streamToken,
        protocol: networkContext.protocol,
        hostname,
        path: session.streamPath,
      })
    : null;

  return {
    viewerMode: "live_browser" as const,
    sessionId: session.sessionId,
    browserSessionId: session.sessionId,
    currentUrl: session.currentUrl,
    finalUrl: session.currentUrl,
    currentTitle: session.title,
    screenshotUrl: session.frameDataUrl,
    frameDataUrl: session.frameDataUrl,
    viewport: session.viewport,
    streamPort: session.streamPort,
    streamPath: session.streamPath,
    streamToken: session.streamToken,
    websocketUrl,
    session,
    lastAction: session.lastAction,
    actionLog: session.actionLog,
  };
}
