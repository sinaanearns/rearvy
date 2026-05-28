import type { WorkTrustedScope } from "@/lib/firebase/schema";

export function normalizeTrustedScope(value: unknown): WorkTrustedScope {
  return value === "read_only" || value === "trusted" ? value : "none";
}

export function normalizeAutoExecute(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

export function canAutoExecute(input: {
  autoExecuteEnabled?: boolean | null;
  trustedScope?: WorkTrustedScope | string | null;
}) {
  return Boolean(input.autoExecuteEnabled) && normalizeTrustedScope(input.trustedScope) === "trusted";
}
