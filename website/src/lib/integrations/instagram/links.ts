export function normalizeInstagramPermalink(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    const hostname = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      (hostname !== "instagram.com" && !hostname.endsWith(".instagram.com"))
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}
