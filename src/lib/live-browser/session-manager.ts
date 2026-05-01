type LiveSession = any;

class LiveBrowserSessionManager {
  private sessions: Map<string, LiveSession>;

  constructor() {
    this.sessions = new Map();
  }

  getSession(_userId: string, sessionId: string) {
    return this.sessions.get(sessionId) ?? null;
  }

  closeSession(sessionId: string) {
    this.sessions.delete(sessionId);
  }

  // Utility to register a session for local testing
  registerSession(sessionId: string, session: LiveSession) {
    this.sessions.set(sessionId, session);
  }
}

function getLiveBrowserSessionManager() {
  const key = "__rearvy_live_browser_manager";
  const globalAny = globalThis as any;
  if (!globalAny[key]) {
    globalAny[key] = new LiveBrowserSessionManager();
  }
  return globalAny[key] as LiveBrowserSessionManager;
}

export { LiveBrowserSessionManager, getLiveBrowserSessionManager };
