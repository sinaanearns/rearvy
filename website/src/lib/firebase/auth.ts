import {
  EmailAuthProvider,
  linkWithCredential,
  reauthenticateWithCredential,
  signInWithPopup,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  setPersistence,
  browserLocalPersistence,
  updatePassword,
} from "firebase/auth";
import { createClientLogger } from "@/lib/client-diagnostics";
import { auth, googleProvider } from "./client";

const log = createClientLogger("FirebaseAuth");

export type DesktopMcpServerConfig = {
  name: string;
  type: "stdio" | "sse";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
};

export type DesktopMcpConfig = {
  mcp_servers?: DesktopMcpServerConfig[];
  servers?: DesktopMcpServerConfig[];
};

type DesktopFileFilter = {
  name: string;
  extensions: string[];
};

type DesktopUpdateState = {
  supported: boolean;
  checking: boolean;
  updateAvailable: boolean;
  downloading: boolean;
  downloaded: boolean;
  currentVersion: string | null;
  latestVersion: string | null;
  downloadPercent: number | null;
  lastCheckedAt: number | null;
  lastError: string | null;
};

declare global {
  interface Window {
    electron?: {
      onAuthCredential?: (
        callback: (credential: {
          idToken?: string | null;
          accessToken?: string | null;
        }) => void
      ) => () => void;
      sendAuthCredential?: (credential: {
        idToken?: string | null;
        accessToken?: string | null;
      }) => void;
      onAuthToken: (callback: (token: string) => void) => () => void;
      sendAuthToken?: (token: string) => void;
      onOpenPath?: (
        callback: (payload: { path: string; cwd: string; kind: "file" | "directory" }) => void
      ) => () => void;
      onDesktopMcpConfig?: (callback: (config: DesktopMcpConfig) => void) => () => void;
      requestDesktopMcpConfig?: () => Promise<DesktopMcpConfig | null>;
      localApiPort?: () => Promise<number | null>;
      onLocalApiPort?: (callback: (port: number) => void) => () => void;
      file?: {
        pickOpenPath: (filters?: DesktopFileFilter[]) => Promise<string | null>;
        readText: (filePath: string) => Promise<string>;
        pickSavePath: (
          defaultPath?: string,
          filters?: DesktopFileFilter[]
        ) => Promise<string | null>;
        writeText: (filePath: string, content: string) => Promise<{ ok: true }>;
      };
      clipboard?: {
        readText: () => Promise<string>;
        writeText: (text: string) => Promise<{ ok: true }>;
      };
      notifications?: {
        show: (
          title: string,
          body?: string
        ) => Promise<{ ok: boolean; reason?: string }>;
      };
      system?: {
        openExternal: (url: string) => Promise<{ ok: true }>;
        revealInFolder: (filePath: string) => Promise<{ ok: true }>;
        captureScreen: () => Promise<string | null>;
        openDevTools?: () => Promise<{ success: boolean }>;
      };
      updater?: {
        getState: () => Promise<DesktopUpdateState>;
        checkForUpdates: () => Promise<{ ok: boolean; reason?: string }>;
        downloadUpdate: () => Promise<{ ok: boolean; reason?: string }>;
        installAndRestart: () => Promise<{ ok: boolean; reason?: string }>;
        onStateChange: (callback: (state: DesktopUpdateState) => void) => () => void;
      };
      automation?: {
        startWorkflow: (workflow: DesktopWorkflow | unknown) => Promise<{ success?: boolean; ok?: boolean; reason?: string; error?: string; state?: unknown }>;
        approveWorkflow: (workflowId: string) => Promise<{ success: boolean; error?: string }>;
        rejectWorkflow: (workflowId: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
        getState: () => Promise<unknown>;
        pause: () => Promise<{ ok: boolean; reason?: string }>;
        resume: () => Promise<{ ok: boolean; reason?: string }>;
        stop: () => Promise<{ ok: boolean; reason?: string }>;
        getHistory: (workflowId?: string) => Promise<unknown>;
        runTest: () => Promise<{ success?: boolean; ok?: boolean; error?: string; reason?: string; state?: unknown }>;
        getBackendCapabilities: () => Promise<{
          ok: boolean;
          preferred?: string;
          providers?: Record<string, { available: boolean; reason?: string }>;
          fallback?: string;
          error?: string;
        }>;
        checkAppInstalled: (appPath: string) => Promise<{ ok: boolean; installed: boolean; reason?: string }>;
        onStateChange: (callback: (state: unknown) => void) => () => void;
        onPaused: (callback: () => void) => () => void;
        onResumed: (callback: () => void) => () => void;
        onStopped: (callback: () => void) => () => void;
      };
      terminal?: {
        runCommand: (options: { command: string; cwd?: string }) => Promise<{ success: boolean; processId?: string; error?: string }>;
        stopProcess: (processId: string) => Promise<{ success: boolean; error?: string }>;
        openExternal: (path?: string) => Promise<{ success: boolean; error?: string }>;
        onOutput: (callback: (data: { id: string; type: string; data: string }) => void) => () => void;
        onStatusChange: (callback: (data: { id: string; status: string; code?: number }) => void) => () => void;
      };
      maria?: {
        setPosition: (x: number, y: number) => void;
        setSize: (width: number, height: number) => void;
        setInteractiveRegions?: (
          regions: Array<
            | { type: "circle"; centerX: number; centerY: number; radius: number }
            | { type: "rect"; x: number; y: number; width: number; height: number }
          >
        ) => void;
        getMousePosition: () => Promise<{ x: number; y: number }>;
        getReadiness?: () => Promise<unknown>;
        runCommand: (command: string | { command: string; requestId?: string; origin?: string }) => Promise<unknown>;
        research?: (command: string | { command: string; requestId?: string; origin?: string }) => Promise<unknown>;
        onStatus: (callback: (status: unknown) => void) => () => void;
        onAssistantEvent?: (callback: (event: MariaAssistantEvent) => void) => () => void;
      };
    };
  }
}

function getErrorCode(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "code" in error) {
    return String((error as { code?: unknown }).code);
  }

  return null;
}

function isExpectedGooglePopupError(code: string | null) {
  return (
    code === "auth/popup-closed-by-user" ||
    code === "auth/cancelled-popup-request" ||
    code === "auth/popup-blocked"
  );
}

// Set persistence to local (survives browser restarts)
if (typeof window !== "undefined") {
  void setPersistence(auth, browserLocalPersistence).catch((error) => {
    log.error("Failed to set Firebase auth persistence:", error);
  });
}

function getFriendlyAuthError(error: unknown) {
  const code = getErrorCode(error);

  if (code === "auth/unauthorized-domain") {
    const hostname =
      typeof window !== "undefined" ? window.location.hostname : "this domain";
    const origin =
      typeof window !== "undefined" ? window.location.origin : null;

    if (hostname === "127.0.0.1") {
      return `Google sign-in is blocked for ${origin ?? hostname}. Add 127.0.0.1 to Firebase Authentication > Settings > Authorized domains, or open the app from http://localhost:3000 instead.`;
    }

    if (hostname === "localhost") {
      return `Google sign-in is blocked for ${origin ?? hostname}. Add localhost to Firebase Authentication > Settings > Authorized domains.`;
    }

    if (hostname.startsWith("www.")) {
      const apexDomain = hostname.replace(/^www\./, "");
      return `Google sign-in is blocked for ${origin ?? hostname}. Add both ${hostname} and ${apexDomain} to Firebase Authentication > Settings > Authorized domains.`;
    }

    const wwwDomain = `www.${hostname}`;

    return `Google sign-in is blocked for ${origin ?? hostname}. Add ${hostname} (and ${wwwDomain} if you use it) to Firebase Authentication > Settings > Authorized domains.`;
  }

  if (code === "auth/popup-blocked") {
    return "The browser blocked the Google sign-in popup. Allow popups and try again.";
  }

  if (code === "auth/popup-closed-by-user") {
    return "The Google sign-in popup was closed before sign-in completed. This can happen if you closed the window or if a browser extension blocked the connection.";
  }

  if (code === "auth/invalid-action-code") {
    return "Google sign-in session became invalid. Please try again.";
  }

  if (code === "auth/weak-password" || code === "auth/invalid-password") {
    return "Password must be at least 8 characters.";
  }

  if (code === "auth/requires-recent-login") {
    return "For security, sign in again and then retry this password change.";
  }

  if (code === "auth/provider-already-linked") {
    return "Password login is already enabled for this account.";
  }

  if (code === "auth/credential-already-in-use") {
    return "This email is already linked to a different account.";
  }

  return error instanceof Error ? error.message : "Authentication failed.";
}

/**
 * Sign in with Google using a popup window.
 */
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return { user: result.user, error: null, redirecting: false };
  } catch (error: unknown) {
    const code = getErrorCode(error);
    const message = getFriendlyAuthError(error);

    if (isExpectedGooglePopupError(code)) {
      log.info("Google sign-in popup did not complete.", { code });
    } else {
      log.error("Google sign-in error:", error);
    }

    return { user: null, error: message, redirecting: false };
  }
}

/**
 * Send a password reset email for email/password users.
 */
export async function sendPasswordReset(email: string) {
  try {
    await sendPasswordResetEmail(auth, email);
    return { error: null };
  } catch (error: unknown) {
    log.error("Password reset error:", error);
    return { error: getFriendlyAuthError(error) };
  }
}

/**
 * Link email/password to the current signed-in user.
 */
export async function linkPasswordToCurrentUser(password: string) {
  const user = auth.currentUser;
  if (!user?.email) {
    return { error: "Could not determine account email." };
  }

  try {
    const credential = EmailAuthProvider.credential(user.email, password);
    await linkWithCredential(user, credential);
    return { error: null };
  } catch (error: unknown) {
    log.error("Link password error:", error);
    return { error: getFriendlyAuthError(error) };
  }
}

/**
 * Update the current signed-in user's password after reauthenticating.
 */
export async function updateCurrentUserPassword(
  currentPassword: string,
  nextPassword: string
) {
  const user = auth.currentUser;
  if (!user?.email) {
    return { error: "Could not determine account email." };
  }

  try {
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, nextPassword);
    return { error: null };
  } catch (error: unknown) {
    log.error("Update password error:", error);
    return { error: getFriendlyAuthError(error) };
  }
}

/**
 * Sign out current user
 */
export async function signOut() {
  try {
    await firebaseSignOut(auth);
    return { error: null };
  } catch (error: unknown) {
    log.error("Sign out error:", error);
    return { error: getFriendlyAuthError(error) };
  }
}

/**
 * Subscribe to auth state changes
 */
export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Get current user
 */
export function getCurrentUser() {
  return auth.currentUser;
}

/**
 * Get ID token for authenticated requests
 */
export async function getIdToken() {
  try {
    await auth.authStateReady();
  } catch (error) {
    log.error("Failed to wait for Firebase auth state before reading token:", error);
  }

  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch (error) {
    // Redirect-based sign-in can occasionally race token hydration.
    // Retry once with force refresh so API calls are not sent unauthenticated.
    log.warn("Failed to read cached ID token, retrying with force refresh:", error);
    return await user.getIdToken(true);
  }
}
