export function normalizeHttpUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed || /[\s\x00-\x1f\x7f]/.test(trimmed)) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    if (url.username || url.password) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}
