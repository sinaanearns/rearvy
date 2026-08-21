export function safeDocId(...parts: Array<string | number | undefined | null>) {
  const id = parts
    .filter((p) => p !== undefined && p !== null)
    .map((p) => String(p))
    .map((s) => s.replace(/[^A-Za-z0-9._-]/g, "_"))
    .join("_");

  return id || "unknown";
}

export default safeDocId;
