import type { Firestore } from "firebase-admin/firestore";
import { encrypt } from "@/lib/utils/encryption";
import { COLLECTIONS } from "@/lib/firebase/schema";

/**
 * Shared Meta Graph API helpers used by the Facebook and Instagram
 * integrations. Both platforms authenticate against the same Graph API and
 * share identical long-lived token exchange, refresh, freshness, fetch, and
 * token-persistence logic. Platform-specific error wording is injected via
 * {@link MetaPlatformLabels} so per-platform messages stay unchanged.
 */

export const GRAPH_API = "https://graph.facebook.com/v21.0";

/** Long-lived Meta tokens last ~60 days. */
export const DEFAULT_META_TOKEN_EXPIRES_IN_SECONDS = 5_184_000;

/** Refresh long-lived tokens once they are within this window of expiring. */
const TOKEN_REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface MetaTokenConfig {
  accessToken: string;
  tokenExpiresAt: Date;
}

export interface MetaTokenResult {
  accessToken: string;
  expiresIn: number;
}

/**
 * Platform-specific error wording. Each platform historically used slightly
 * different phrasing, so the exact messages are supplied by the caller and
 * kept identical to their pre-refactor values. `apiLabel` names the platform
 * in generic API errors (e.g. "Facebook" or "Instagram").
 */
export interface MetaPlatformLabels {
  apiLabel: string;
  exchangeFailure: string;
  exchangeMissingToken: string;
  refreshFailure: string;
  refreshMissingToken: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readMetaCredentials() {
  const clientId = process.env.META_APP_ID;
  const clientSecret = process.env.META_APP_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing Meta OAuth credentials");
  }
  return { clientId, clientSecret };
}

function parseMetaTokenResponse(
  value: unknown,
  fallbackError: string
): MetaTokenResult {
  if (!isRecord(value)) {
    throw new Error(fallbackError);
  }

  if (typeof value.access_token !== "string" || !value.access_token.trim()) {
    const message =
      typeof value.error_description === "string"
        ? value.error_description
        : typeof value.error === "string"
          ? value.error
          : fallbackError;
    throw new Error(message);
  }

  return {
    accessToken: value.access_token,
    expiresIn:
      typeof value.expires_in === "number" &&
      Number.isFinite(value.expires_in) &&
      value.expires_in > 0
        ? value.expires_in
        : DEFAULT_META_TOKEN_EXPIRES_IN_SECONDS,
  };
}

async function fbTokenExchange(
  token: string,
  failureError: string,
  fallbackError: string
): Promise<MetaTokenResult> {
  const { clientId, clientSecret } = readMetaCredentials();
  const url = new URL(`${GRAPH_API}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("fb_exchange_token", token);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${failureError} (${res.status}): ${text}`);
  }

  return parseMetaTokenResponse(await res.json(), fallbackError);
}

export function exchangeForLongLivedToken(
  shortLivedToken: string,
  labels: MetaPlatformLabels
): Promise<MetaTokenResult> {
  return fbTokenExchange(
    shortLivedToken,
    labels.exchangeFailure,
    labels.exchangeMissingToken
  );
}

export function refreshLongLivedToken(
  currentToken: string,
  labels: MetaPlatformLabels
): Promise<MetaTokenResult> {
  return fbTokenExchange(
    currentToken,
    labels.refreshFailure,
    labels.refreshMissingToken
  );
}

/** Refresh the config's token in place if it is close to expiring. */
export async function ensureFreshToken(
  config: MetaTokenConfig,
  labels: MetaPlatformLabels
): Promise<string> {
  if (config.tokenExpiresAt.getTime() - Date.now() < TOKEN_REFRESH_WINDOW_MS) {
    const refreshed = await refreshLongLivedToken(config.accessToken, labels);
    config.accessToken = refreshed.accessToken;
    config.tokenExpiresAt = new Date(Date.now() + refreshed.expiresIn * 1000);
  }
  return config.accessToken;
}

/** Generic authenticated Graph API GET with automatic token refresh. */
export async function metaFetch<T>(
  config: MetaTokenConfig,
  url: string,
  labels: MetaPlatformLabels,
  params?: Record<string, string>
): Promise<T> {
  const token = await ensureFreshToken(config, labels);
  const u = new URL(url);
  u.searchParams.set("access_token", token);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      u.searchParams.set(k, v);
    }
  }

  const res = await fetch(u.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${labels.apiLabel} API error (${res.status}): ${text}`);
  }

  const data: unknown = await res.json();
  return data as T;
}

/** Persist a refreshed access token (encrypted) back to the integration doc. */
export async function persistRefreshedToken(
  db: Firestore,
  integrationId: string,
  accessToken: string,
  expiresAt: Date
): Promise<void> {
  const { encrypted, iv } = encrypt(accessToken);
  await db
    .collection(COLLECTIONS.INTEGRATIONS)
    .doc(integrationId)
    .update({
      access_token_enc: encrypted,
      token_iv: iv,
      token_expires_at: expiresAt.toISOString(),
    });
}
