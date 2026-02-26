import type { NextRequest } from "next/server";

/**
 * Resolves the application origin from the NEXT_PUBLIC_APP_URL env var,
 * falling back to the request origin when the env value is missing or
 * malformed.  Useful in API routes that need to build absolute redirect
 * URLs.
 */
export function getAppOrigin(request: NextRequest): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL;
  if (raw) {
    try {
      return new URL(raw).origin;
    } catch {
      // Fall back to request origin when env value is malformed.
    }
  }

  return request.nextUrl.origin;
}
