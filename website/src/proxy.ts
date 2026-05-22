import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const BLOCKED_DESKTOP_PREFIXES = [
  "/download",
  "/demo",
  "/features",
  "/terms",
  "/privacy",
  "/privacy-policy",
  "/data-delete",
];

const BLOCKED_DESKTOP_EXACT = new Set(["/", "/403", "/home"]);

function isElectronRequest(request: NextRequest): boolean {
  const userAgent = (request.headers.get("user-agent") || "").toLowerCase();
  return userAgent.includes("electron");
}

function isBlockedDesktopPath(pathname: string): boolean {
  if (BLOCKED_DESKTOP_EXACT.has(pathname)) {
    return true;
  }

  return BLOCKED_DESKTOP_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function proxy(request: NextRequest) {
  if (!isElectronRequest(request)) {
    return NextResponse.next();
  }

  if (!isBlockedDesktopPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/login";
  redirectUrl.search = "";

  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: [
    "/",
    "/home",
    "/403",
    "/download/:path*",
    "/demo/:path*",
    "/features/:path*",
    "/terms/:path*",
    "/privacy/:path*",
    "/privacy-policy/:path*",
    "/data-delete/:path*",
  ],
};
