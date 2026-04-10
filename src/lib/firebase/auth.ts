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
import { auth, googleProvider } from "./client";

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

/**
 * Sign in with Google using a popup window.
 */
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return { user: result.user, error: null, redirecting: false };
  } catch (error: unknown) {
    console.error("Google sign-in error:", error);
    return { user: null, error: getFriendlyAuthError(error), redirecting: false };
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
