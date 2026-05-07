export const BROWSER_WORKSPACE_PREFERENCE_KEY = "rearvy.browser-workspace.v1";

export function readBrowserWorkspacePreference(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const val = window.localStorage.getItem(key);
    return val === "true";
  } catch {
    return false;
  }
}

export function writeBrowserWorkspacePreference(key: string, value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // ignore
  }
}
