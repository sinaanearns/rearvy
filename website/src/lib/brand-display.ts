import { APP_NAME } from "@/lib/utils/constants";

const STALE_REARVY_NAME = /^rarville$/i;

export function normalizeRearvyDisplayText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return STALE_REARVY_NAME.test(trimmed) ? APP_NAME : trimmed;
}

