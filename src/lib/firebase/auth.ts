import {
  signInWithPopup,
  signInWithRedirect,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { auth, googleProvider } from "./client";

// Set persistence to local (survives browser restarts)
if (typeof window !== "undefined") {
  void setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error("Failed to set Firebase auth persistence:", error);
  });
}

function getFriendlyAuthError(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : null;

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

    return `Google sign-in is blocked for ${origin ?? hostname}. Add ${hostname} to Firebase Authentication > Settings > Authorized domains.`;
  }

  if (code === "auth/popup-blocked") {
    return "The browser blocked the Google sign-in popup. Allow popups and try again.";
  }

  if (code === "auth/popup-closed-by-user") {
    return "The Google sign-in popup was closed before sign-in completed.";
  }

  return error instanceof Error ? error.message : "Authentication failed.";
}

/**
 * Sign in with Google using popup
 */
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return { user: result.user, error: null };
  } catch (error: unknown) {
    console.error("Google sign-in error:", error);
    return { user: null, error: getFriendlyAuthError(error) };
  }
}

/**
 * Sign in with Google using redirect (better for mobile)
 */
export async function signInWithGoogleRedirect() {
  try {
    await signInWithRedirect(auth, googleProvider);
    return { error: null };
  } catch (error: unknown) {
    console.error("Google sign-in redirect error:", error);
    return { error: getFriendlyAuthError(error) };
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
  const user = auth.currentUser;
  if (!user) return null;
  return await user.getIdToken();
}
