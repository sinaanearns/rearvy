export type BrowserbaseSessionStatus =
  | "PENDING"
  | "RUNNING"
  | "ERROR"
  | "TIMED_OUT"
  | "COMPLETED";

export type BrowserbaseSessionSnapshot = {
  id: string;
  status: BrowserbaseSessionStatus | string;
  connectUrl?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  expiresAt?: string | null;
};

export async function waitForBrowserbaseSessionReady(
  retrieveSession: (id: string) => Promise<BrowserbaseSessionSnapshot>,
  providerSessionId: string,
  options?: { timeoutMs?: number; intervalMs?: number }
): Promise<BrowserbaseSessionSnapshot> {
  const timeoutMs = options?.timeoutMs ?? 45000;
  const intervalMs = options?.intervalMs ?? 2500;
  const startedAt = Date.now();
  let lastSnapshot: BrowserbaseSessionSnapshot | null = null;

  while (Date.now() - startedAt < timeoutMs) {
    const snapshot = await retrieveSession(providerSessionId);
    lastSnapshot = snapshot;
    if (snapshot.status === "RUNNING") {
      return snapshot;
    }
    if (snapshot.status === "ERROR" || snapshot.status === "TIMED_OUT" || snapshot.status === "COMPLETED") {
      throw new Error(`Browserbase session ${providerSessionId} stopped before it became ready: ${snapshot.status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `Browserbase session ${providerSessionId} did not become ready within ${timeoutMs}ms${lastSnapshot ? ` (last status: ${lastSnapshot.status})` : ""}`
  );
}
