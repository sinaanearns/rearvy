import { normalizeHttpUrl } from "@/lib/chat/url-normalization";

export function normalizeIntegrationNavigationUrl(value: unknown) {
  return typeof value === "string" ? normalizeHttpUrl(value) : null;
}

export function requireIntegrationNavigationUrl(value: unknown) {
  const url = normalizeIntegrationNavigationUrl(value);
  if (!url) {
    throw new Error("Invalid authorization URL received from server");
  }

  return url;
}
