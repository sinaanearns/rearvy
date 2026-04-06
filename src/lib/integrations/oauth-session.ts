import type { NextRequest, NextResponse } from "next/server";

type OAuthCookiePrefix =
  | "shopify_oauth"
  | "youtube_oauth"
  | "instagram_oauth"
  | "facebook_oauth"
  | "ga4_oauth"
  | "gmail_oauth";

function getCookieDomain(): string | undefined {
  const rawOrigin = process.env.NEXT_PUBLIC_APP_URL ?? process.env.HOST;
  if (!rawOrigin) {
    return undefined;
  }

  try {
    const hostname = new URL(rawOrigin).hostname.toLowerCase();

    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      /^\d+\.\d+\.\d+\.\d+$/.test(hostname)
    ) {
      return undefined;
    }

    if (!hostname.includes(".")) {
      return undefined;
    }

    return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
  } catch {
    return undefined;
  }
}

function getOAuthCookieOptions() {
  const domain = getCookieDomain();

  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 600,
    path: "/",
    ...(domain ? { domain } : {}),
  };
}

export function setOAuthSessionCookies(
  response: NextResponse,
  prefix: OAuthCookiePrefix,
  state: string,
  userId: string
) {
  const oauthCookieOptions = getOAuthCookieOptions();
  response.cookies.set(`${prefix}_state`, state, oauthCookieOptions);
  response.cookies.set(`${prefix}_uid`, userId, oauthCookieOptions);
}

export function getOAuthSessionUserId(
  request: NextRequest,
  prefix: OAuthCookiePrefix
) {
  return request.cookies.get(`${prefix}_uid`)?.value ?? null;
}

export function clearOAuthSessionCookies(
  response: NextResponse,
  prefix: OAuthCookiePrefix
) {
  const oauthCookieOptions = getOAuthCookieOptions();
  response.cookies.set(`${prefix}_state`, "", {
    ...oauthCookieOptions,
    maxAge: 0,
  });
  response.cookies.set(`${prefix}_uid`, "", {
    ...oauthCookieOptions,
    maxAge: 0,
  });
}
