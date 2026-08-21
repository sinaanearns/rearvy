export const BROWSER_WORKSPACE_PREFERENCE_KEY = "rearvy.browser-workspace.v1";
export const BROWSER_CONNECTION_PREFERENCE_KEY = "rearvy.browser-connection-preference.v1";

export type BrowserConnectionPreferenceChoice = "managed-runner" | "extension-relay" | "cdp-direct" | "firecrawl" | null;

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

export function readBrowserConnectionPreference(): BrowserConnectionPreferenceChoice {
  if (typeof window === "undefined") return null;
  try {
    const val = window.localStorage.getItem(BROWSER_CONNECTION_PREFERENCE_KEY);
    if (val === "managed-runner" || val === "extension-relay" || val === "cdp-direct" || val === "firecrawl") {
      return val;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeBrowserConnectionPreference(choice: BrowserConnectionPreferenceChoice): void {
  if (typeof window === "undefined") return;
  try {
    if (choice) {
      window.localStorage.setItem(BROWSER_CONNECTION_PREFERENCE_KEY, choice);
    } else {
      window.localStorage.removeItem(BROWSER_CONNECTION_PREFERENCE_KEY);
    }
  } catch {
    // ignore
  }
}
