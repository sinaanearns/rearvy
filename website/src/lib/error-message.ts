function firstNonEmptyString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function getReadableErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string") {
    const trimmed = error.trim();
    return trimmed || fallback;
  }

  if (error instanceof Error) {
    const message = error.message.trim();
    if (message) {
      return message;
    }

    if (error.cause) {
      return getReadableErrorMessage(error.cause, fallback);
    }

    return fallback;
  }

  if (isRecord(error)) {
    const record = error;
    const message = firstNonEmptyString(
      record.message,
      record.error,
      record.detail,
      record.reason,
      record.statusText
    );

    if (message) {
      return message;
    }

    if ("cause" in record) {
      return getReadableErrorMessage(record.cause, fallback);
    }
  }

  return fallback;
}
