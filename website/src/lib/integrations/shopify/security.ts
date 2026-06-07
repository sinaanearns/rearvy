import { createHmac, timingSafeEqual } from "crypto";
import { parseJsonRecord } from "@/lib/ai/json-object";

const SHOPIFY_DOMAIN_REGEX =
  /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.myshopify\.com$/;

function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");

  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export function normalizeShopifyDomain(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;

  const noProtocol = trimmed.replace(/^https?:\/\//, "");
  const hostOnly = noProtocol.split("/")[0];
  const normalized = hostOnly.endsWith(".myshopify.com")
    ? hostOnly
    : `${hostOnly}.myshopify.com`;

  if (!SHOPIFY_DOMAIN_REGEX.test(normalized)) {
    return null;
  }

  return normalized;
}

export function isRecentShopifyTimestamp(
  timestamp: string | null,
  maxAgeSeconds = 300
): boolean {
  if (!timestamp) return false;

  const parsed = Number(timestamp);
  if (!Number.isFinite(parsed)) return false;

  const now = Math.floor(Date.now() / 1000);
  return Math.abs(now - parsed) <= maxAgeSeconds;
}

export function verifyShopifyOAuthHmac(
  searchParams: URLSearchParams,
  apiSecret: string
): boolean {
  const providedHmac = searchParams.get("hmac");
  if (!providedHmac) return false;

  const message = [...searchParams.entries()]
    .filter(([key]) => key !== "hmac" && key !== "signature")
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  const digest = createHmac("sha256", apiSecret).update(message).digest("hex");
  return safeCompare(digest, providedHmac.toLowerCase());
}

export function verifyShopifyWebhookHmac(
  rawBody: string,
  providedHmac: string,
  webhookSecret: string
): boolean {
  if (!providedHmac) return false;

  const digest = createHmac("sha256", webhookSecret)
    .update(rawBody, "utf8")
    .digest("base64");

  return safeCompare(digest, providedHmac);
}

export function parseShopifyWebhookPayload(rawBody: string): Record<string, unknown> | null {
  return parseJsonRecord(rawBody);
}
