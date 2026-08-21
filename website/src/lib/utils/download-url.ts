export const DEFAULT_WINDOWS_INSTALLER_FILE = "RearvyUserSetup-x64.exe";
export const DEFAULT_MAC_INSTALLER_FILE = "Rearvy-mac-universal.dmg";
export const REARVY_BROWSER_EXTENSION_FILE = "RearvyBrowserRelay.zip";
export const REARVY_BROWSER_EXTENSION_METADATA_FILE = "browser-extension.json";
export const REARVY_BROWSER_EXTENSION_DOWNLOAD_URL = `/downloads/${REARVY_BROWSER_EXTENSION_FILE}`;

export const DEFAULT_WINDOWS_DOWNLOAD_URL =
  "https://github.com/mutalvita-cyber/rearvy-desktop-releases/releases/latest/download/RearvyUserSetup-x64.exe";
export const DEFAULT_MAC_DOWNLOAD_URL =
  "https://github.com/mutalvita-cyber/rearvy-desktop-releases/releases/latest/download/Rearvy-mac-universal.dmg";

const staleDownloadUrlMarkers = [
  "github.com/mutalvita-cyber/rearvy2.0/",
  "/releases/download/v0.1.0/",
  "Rearvy-win-x64.exe",
];

function resolveDesktopDownloadUrl(configuredUrl: string | undefined, defaultUrl: string): string {
  const candidate = configuredUrl?.trim();

  if (!candidate || staleDownloadUrlMarkers.some((marker) => candidate.includes(marker))) {
    return defaultUrl;
  }

  try {
    const url = new URL(candidate);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {
    // Fall back below when the configured installer URL is malformed.
  }

  return defaultUrl;
}

export function resolveWindowsDownloadUrl(configuredUrl = process.env.NEXT_PUBLIC_WINDOWS_DOWNLOAD_URL): string {
  return resolveDesktopDownloadUrl(configuredUrl, DEFAULT_WINDOWS_DOWNLOAD_URL);
}

export function resolveMacDownloadUrl(configuredUrl = process.env.NEXT_PUBLIC_MAC_DOWNLOAD_URL): string {
  return resolveDesktopDownloadUrl(configuredUrl, DEFAULT_MAC_DOWNLOAD_URL);
}
