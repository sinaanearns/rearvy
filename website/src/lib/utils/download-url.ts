export const DEFAULT_WINDOWS_INSTALLER_FILE = "RearvyUserSetup-x64.exe";

export const DEFAULT_WINDOWS_DOWNLOAD_URL =
  "https://github.com/mutalvita-cyber/rearvy-desktop-releases/releases/latest/download/RearvyUserSetup-x64.exe";

const staleDownloadUrlMarkers = [
  "github.com/mutalvita-cyber/rearvy2.0/",
  "/releases/download/v0.1.0/",
  "Rearvy-win-x64.exe",
];

export function resolveWindowsDownloadUrl(configuredUrl = process.env.NEXT_PUBLIC_WINDOWS_DOWNLOAD_URL): string {
  const candidate = configuredUrl?.trim();

  if (!candidate || staleDownloadUrlMarkers.some((marker) => candidate.includes(marker))) {
    return DEFAULT_WINDOWS_DOWNLOAD_URL;
  }

  try {
    const url = new URL(candidate);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {
    // Fall back below when the configured installer URL is malformed.
  }

  return DEFAULT_WINDOWS_DOWNLOAD_URL;
}
