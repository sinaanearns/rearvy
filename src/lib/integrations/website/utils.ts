import { randomBytes } from "crypto";

export function generateSiteId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(12);
  let result = "rv_";
  for (let i = 0; i < 12; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

export function normalizeDomain(input: string): string | null {
  let domain = input.trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//, "");
  domain = domain.replace(/^www\./, "");
  domain = domain.split("/")[0];
  if (
    !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(
      domain
    )
  ) {
    return null;
  }
  return domain;
}

export function buildTrackingSnippet(
  siteId: string,
  appOrigin: string,
  trackingToken: string
): string {
  return `<script defer src="${appOrigin}/t.js" data-site="${siteId}" data-token="${trackingToken}"></script>`;
}
