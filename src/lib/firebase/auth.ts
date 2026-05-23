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
  signInWithCredential,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth, googleProvider } from "./client";

let desktopCredentialInFlight = false;

async function signInWithDesktopCredential({
  idToken,
  accessToken,
}: {
  idToken?: string | null;
  accessToken?: string | null;
}) {
  if (!idToken && !accessToken) {
    throw new Error("No Google credential was returned to the desktop app.");
  }

  if (desktopCredentialInFlight) {
    return;
  }

  desktopCredentialInFlight = true;
  const credential = GoogleAuthProvider.credential(
    idToken ?? null,
    accessToken ?? null
  );
  try {
    const result = await signInWithCredential(auth, credential);

    // After signing in via desktop credential, attempt to finalize the
    // authenticated user's profile on the server the same way the website
    // does. This avoids races where redirect/popup flows complete but the
    // server-side profile initialization hasn't run yet.
    try {
      const user = result.user ?? auth.currentUser;
      if (user) {
        const token = await user.getIdToken(true);
        await fetch("/api/auth/initialize-profile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            fullName: user.displayName || "",
            avatarUrl: user.photoURL || "",
          }),
        });
      }
    } catch (initErr) {
      console.error("Failed to finalize profile after desktop sign-in:", initErr);
    }
  } catch (error) {
    desktopCredentialInFlight = false;
    throw error;
  }
}

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
        getHistory: (workflowId: string) => Promise<unknown>;
        runTest: () => Promise<{ ok: boolean; reason?: string }>;
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
      clicky?: {
        setPosition: (x: number, y: number) => void;
        setSize: (width: number, height: number) => void;
        getMousePosition: () => Promise<{ x: number; y: number }>;
        runCommand: (command: string) => Promise<unknown>;
        onStatus: (callback: (status: unknown) => void) => () => void;
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

// Set persistence to local (survives browser restarts)
if (typeof window !== "undefined") {
  void setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error("Failed to set Firebase auth persistence:", error);
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
    return "The Google sign-in popup was closed before sign-in completed.";
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

function getDesktopBridgeOrigin() {
  if (typeof window === "undefined") {
    return null;
  }

  const currentOrigin = window.location.origin;
  if (/^https?:\/\//i.test(currentOrigin)) {
    return currentOrigin;
  }

  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredAppUrl) {
    try {
      const parsed = new URL(configuredAppUrl);
      if (parsed.protocol === "https:" || parsed.protocol === "http:") {
        return parsed.origin;
      }
    } catch {
      // ignore invalid NEXT_PUBLIC_APP_URL and fall back to production domain
    }
  }

  return "https://rearvy.com";
}

/**
 * Sign in with Google using a popup window.
 * In Electron, this triggers an external browser flow.
 */
export async function signInWithGoogle() {
  const isElectron =
    typeof window !== "undefined" &&
    (window.navigator.userAgent.includes("Electron") || !!window.electron);

  if (isElectron) {
    const origin = getDesktopBridgeOrigin() || window.location.origin;
    const bridgeUrl = `${origin}/auth/desktop-signin`;
    window.open(bridgeUrl, "_blank");
    return { user: null, error: null, redirecting: true };
  }

  try {
    const result = await signInWithPopup(auth, googleProvider);
    return { user: result.user, error: null, redirecting: false };
  } catch (error: unknown) {
    console.error("Google sign-in error:", error);
    return { user: null, error: getFriendlyAuthError(error), redirecting: false };
  }
}

// Handle tokens received via Electron deep links
if (typeof window !== "undefined" && window.electron) {
  window.electron.onAuthCredential?.((credential) => {
    void signInWithDesktopCredential(credential).catch((error) => {
      console.error(
        "Failed to sign in with Google credential from desktop:",
        error
      );
    });
  });

  window.electron.onAuthToken((token: string) => {
    void signInWithDesktopCredential({ idToken: token }).catch((error) => {
      console.error(
        "Failed to sign in with Google token from desktop:",
        error
      );
    });
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) {
      return;
    }

    if (event.data?.type !== "rearvy-auth-credential") {
      return;
    }

    void signInWithDesktopCredential(event.data.credential).catch((error) => {
      console.error(
        "Failed to sign in with Google credential from desktop message:",
        error
      );
    });
  });

  // If the opener missed the postMessage (race), the desktop sign-in page
  // writes the credential into localStorage as a fallback. Check for that
  // value on load and consume it if present.
  try {
    const raw = localStorage.getItem("rearvy.desktopAuthCredential");
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as {
          idToken?: string | null;
          accessToken?: string | null;
          ts?: number;
        };

        // Consume the stored credential and remove it so it isn't reused.
        localStorage.removeItem("rearvy.desktopAuthCredential");

        if (parsed?.idToken || parsed?.accessToken) {
          void signInWithDesktopCredential({
            idToken: parsed.idToken,
            accessToken: parsed.accessToken,
          }).catch((error) => {
            console.error(
              "Failed to sign in with Google credential from localStorage:",
              error
            );
          });
        }
      } catch (err) {
        // Ignore malformed stored payloads
        localStorage.removeItem("rearvy.desktopAuthCredential");
      }
    }
  } catch (err) {
    // Ignore localStorage access errors (e.g., private browsing)
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
    console.error("Password reset error:", error);
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
    console.error("Link password error:", error);
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
    console.error("Update password error:", error);
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
    console.error("Sign out error:", error);
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
    console.error("Failed to wait for Firebase auth state before reading token:", error);
  }

  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch (error) {
    // Redirect-based sign-in can occasionally race token hydration.
    // Retry once with force refresh so API calls are not sent unauthenticated.
    console.warn("Failed to read cached ID token, retrying with force refresh:", error);
    return await user.getIdToken(true);
  }
}
