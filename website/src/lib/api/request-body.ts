export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isRequestBodyError(error: unknown): error is Error {
  return (
    error instanceof Error &&
    (error.message === "Invalid JSON body." ||
      error.message === "Request body must be a JSON object.")
  );
}

export async function readJsonRecord(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new Error("Invalid JSON body.");
  }

  if (!isRecord(body)) {
    throw new Error("Request body must be a JSON object.");
  }

  return body;
}
