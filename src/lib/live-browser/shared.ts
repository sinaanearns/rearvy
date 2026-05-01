export type BrowserActionLogEntry = {
  id: string;
  action: string;
  status: string;
  message: string;
  timestamp: string;
  // Optional metadata that some sessions may include.
  metadata?: Record<string, unknown> | null;
};

export function buildBrowserWebSocketUrl(options: {
  protocol?: string | null;
  hostname?: string | null;
  port?: number | string | null;
  path?: string | null;
  sessionId?: string | null;
  streamToken?: string | null;
}): string | null {
  const {
    protocol = "http:",
    hostname = null,
    port = null,
    path = "/browser-stream",
    sessionId = null,
    streamToken = null,
  } = options ?? {};

  if (!hostname) {
    return null;
  }

  const wsScheme = protocol === "https:" ? "wss" : "ws";
  const host = port ? `${hostname}:${port}` : hostname;

  // Ensure path begins with '/'
  const normalizedPath = path && path.startsWith("/") ? path : `/${path}`;

  try {
    const url = new URL(`${wsScheme}://${host}${normalizedPath}`);
    if (sessionId) url.searchParams.set("sessionId", sessionId);
    if (streamToken) url.searchParams.set("streamToken", streamToken);
    return url.toString();
  } catch {
    return null;
  }
}
