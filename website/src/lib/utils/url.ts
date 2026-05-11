import type { NextRequest } from "next/server";

function stripWrappingQuotes(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function normalizeRearvyOrigin(origin: string) {
  try {
    const url = new URL(stripWrappingQuotes(origin));
    if (url.hostname === "rearvy.com") {
      url.hostname = "www.rearvy.com";
    }
    return url.origin;
  } catch {
    return origin;
  }
}

/**
 * Resolves the application origin from the NEXT_PUBLIC_APP_URL env var,
 * falling back to the request origin when the env value is missing or
 * malformed. Useful in API routes that need to build absolute redirect
 * URLs. Rearvy production canonicalizes to the `www` host.
 */
export function getAppOrigin(request: NextRequest): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL;
  if (raw) {
    try {
      return normalizeRearvyOrigin(new URL(stripWrappingQuotes(raw)).origin);
    } catch {
      // Fall back to request origin when env value is malformed.
    }
  }

  // In production, never trust request host headers for absolute redirects.
  // This prevents origin spoofing if deployment is misconfigured.
  if (process.env.NODE_ENV === "production") {
    return "https://www.rearvy.com";
  }

  return request.nextUrl.origin;
}
