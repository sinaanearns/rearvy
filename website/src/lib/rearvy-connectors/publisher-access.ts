const ELIGIBLE_REGISTRATION_STATUSES = new Set([
  "new",
  "reviewed",
  "contacted",
  "approved",
]);

export function normalizePublisherEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized && normalized.includes("@") ? normalized : null;
}

export function isBusinessPublisherProfile(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return (value as Record<string, unknown>).account_kind === "business";
}

export function isEligibleBusinessRegistration(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const status = (value as Record<string, unknown>).status;
  return typeof status === "string" && ELIGIBLE_REGISTRATION_STATUSES.has(status.trim().toLowerCase());
}
