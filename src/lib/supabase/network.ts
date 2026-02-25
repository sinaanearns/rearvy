import { AuthError, type UserResponse } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_FETCH_TIMEOUT_MS = 4000;

function parseTimeoutMs(rawValue: string | undefined): number {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_SUPABASE_FETCH_TIMEOUT_MS;
  }
  return Math.floor(parsed);
}

export function getSupabaseFetchTimeoutMs() {
  return parseTimeoutMs(process.env.SUPABASE_FETCH_TIMEOUT_MS);
}

const supabaseFetchWithTimeoutImpl = async (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1]
) => {
  const timeoutMs = getSupabaseFetchTimeoutMs();
  const requestInit = init ?? {};

  // Respect an existing abort signal set by callers.
  if (timeoutMs <= 0 || requestInit.signal) {
    return fetch(input, requestInit);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...requestInit,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
};

export const supabaseFetchWithTimeout =
  supabaseFetchWithTimeoutImpl as typeof fetch;

export function isSupabaseNetworkError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error.name === "AbortError") {
    return true;
  }

  const message = error.message.toLowerCase();
  if (message.includes("fetch failed") || message.includes("network")) {
    return true;
  }

  const cause = (error as { cause?: unknown }).cause;
  if (!cause || typeof cause !== "object") {
    return false;
  }

  const causeCode =
    "code" in cause
      ? String((cause as { code?: unknown }).code ?? "")
      : "";

  return (
    causeCode.startsWith("UND_ERR_") ||
    causeCode === "ETIMEDOUT" ||
    causeCode === "ECONNREFUSED" ||
    causeCode === "ENOTFOUND"
  );
}

export function anonymousUserResponse(): UserResponse {
  return {
    data: { user: null },
    error: new AuthError("Supabase auth request failed"),
  };
}
