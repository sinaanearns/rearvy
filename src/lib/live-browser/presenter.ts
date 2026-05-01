export function serializeLiveBrowserSession(session: any, _networkContext: { protocol?: string; hostname?: string } | null = null) {
  // Minimal serializer for build-time. Expand as needed for frontend consumption.
  return {
    sessionId: session?.sessionId ?? null,
    currentUrl: session?.currentUrl ?? null,
    title: session?.title ?? null,
    frameDataUrl: session?.frameDataUrl ?? null,
    viewport: session?.viewport ?? null,
    actionLog: session?.actionLog ?? [],
    lastAction: session?.lastAction ?? null,
    status: session?.status ?? null,
  };
}

export default serializeLiveBrowserSession;
