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

  if (error && typeof error === "object" && !Array.isArray(error)) {
    const record = error as Record<string, unknown>;
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