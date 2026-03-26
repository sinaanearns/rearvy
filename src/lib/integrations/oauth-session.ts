import type { NextRequest, NextResponse } from "next/server";

type OAuthCookiePrefix =
  | "shopify_oauth"
  | "youtube_oauth"
  | "instagram_oauth"
  | "facebook_oauth"
  | "ga4_oauth"
  | "gmail_oauth";

const oauthCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 600,
  path: "/",
};

export function setOAuthSessionCookies(
  response: NextResponse,
  prefix: OAuthCookiePrefix,
  state: string,
  userId: string
) {
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
  response.cookies.delete(`${prefix}_state`);
  response.cookies.delete(`${prefix}_uid`);
}
