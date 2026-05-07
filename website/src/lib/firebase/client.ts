import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const defaultFirebaseConfig = {
  apiKey: "AIzaSyAK5i2w6iqvUZGw5UmnllKJJtxiIRmGxkk",
  authDomain: "www.rearvy.com",
  projectId: "rearvy-74c50",
  storageBucket: "rearvy-74c50.firebasestorage.app",
  messagingSenderId: "396066975305",
  appId: "1:396066975305:web:7b8de2b0ef37eb94769998",
  measurementId: "G-2XGLPM8079",
} as const;

function extractHostname(value: string | undefined | null) {
  if (!value) return "";

  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    return new URL(trimmed).hostname.toLowerCase();
  } catch {
    return trimmed
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, "")
      .toLowerCase();
  }
}

function isLocalDevelopmentHost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    /^\d+\.\d+\.\d+\.\d+$/.test(hostname)
  );
}

function shouldUseCurrentHost(currentHost: string, configuredHost: string) {
  if (!currentHost || !configuredHost) {
    return false;
  }

  if (currentHost === configuredHost) {
    return true;
  }

  if (currentHost === `www.${configuredHost}`) {
    return true;
  }

  if (configuredHost === `www.${currentHost}`) {
    return true;
  }

  return false;
}

function resolveAuthDomain() {
  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ||
    defaultFirebaseConfig.projectId;
  const configuredDomain =
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() ||
    defaultFirebaseConfig.authDomain;
  const configuredHost = extractHostname(configuredDomain);
  const appUrlHost = extractHostname(process.env.NEXT_PUBLIC_APP_URL);
  const currentHost =
    typeof window !== "undefined" ? window.location.hostname.toLowerCase() : "";
  const hostedFirebaseDomain = `${projectId}.firebaseapp.com`;

  if (isLocalDevelopmentHost(currentHost)) {
    return hostedFirebaseDomain;
  }

  if (appUrlHost && isLocalDevelopmentHost(appUrlHost)) {
    return hostedFirebaseDomain;
  }

  if (shouldUseCurrentHost(currentHost, configuredHost)) {
    return currentHost;
  }

  if (appUrlHost && shouldUseCurrentHost(appUrlHost, configuredHost)) {
    return appUrlHost;
  }

  return configuredDomain;
}

const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() ||
    defaultFirebaseConfig.apiKey,
  authDomain: resolveAuthDomain(),
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ||
    defaultFirebaseConfig.projectId,
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() ||
    defaultFirebaseConfig.storageBucket,
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() ||
    defaultFirebaseConfig.messagingSenderId,
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim() ||
    defaultFirebaseConfig.appId,
  measurementId:
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID?.trim() ||
    defaultFirebaseConfig.measurementId,
};

// Initialize Firebase (singleton pattern)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase Auth
export const auth = getAuth(app);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Analytics only in browser environments where it's supported.
export const analyticsPromise: Promise<Analytics | null> =
  typeof window === "undefined"
    ? Promise.resolve(null)
    : isSupported()
        .then((supported) => (supported ? getAnalytics(app) : null))
        .catch(() => null);

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account",
});

export default app;
