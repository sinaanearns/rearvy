"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithCustomToken,
  User,
} from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { onAuthChange } from "@/lib/firebase/auth";
import { createClientLogger } from "@/lib/client-diagnostics";

const log = createClientLogger("AuthProvider");

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let unsubscribeDesktopToken: (() => void) | undefined;
    let unsubscribeDesktopCredential: (() => void) | undefined;
    let desktopAuthAttached = false;
    const fallbackTimeout = window.setTimeout(() => {
      // authStateReady() can stall in an Electron renderer when persistence
      // hydration is delayed. Keep the UI usable while the already-attached
      // observer continues to receive the eventual auth state.
      if (!active) {
        return;
      }

      setUser(auth.currentUser);
      setLoading(false);
    }, 8000);

    const attachDesktopAuthListeners = () => {
      if (desktopAuthAttached || !window.electron) {
        return;
      }

      desktopAuthAttached = true;

      if (window.electron.onAuthToken) {
        unsubscribeDesktopToken = window.electron.onAuthToken((token) => {
          if (!token) {
            return;
          }

          void signInWithCustomToken(auth, token).catch((error) => {
            log.error("Failed to sign in with desktop auth token:", error);
          });
        });
      }

      if (window.electron.onAuthCredential) {
        unsubscribeDesktopCredential = window.electron.onAuthCredential(
          (credential) => {
            if (!credential?.idToken && !credential?.accessToken) {
              return;
            }

            const googleCredential = GoogleAuthProvider.credential(
              credential.idToken || null,
              credential.accessToken || null
            );

            void signInWithCredential(auth, googleCredential).catch((error) => {
              log.error(
                "Failed to sign in with desktop auth credential:",
                error
              );
            });
          }
        );
      }
    };

    // Register first. Waiting for authStateReady() before registering meant a
    // delayed Firebase persistence read could leave desktop users on the
    // dashboard loading screen forever, even after auth eventually recovered.
    const unsubscribe = onAuthChange((nextUser) => {
      if (!active) {
        return;
      }

      setUser(nextUser);
      setLoading(false);
      window.clearTimeout(fallbackTimeout);
    });

    attachDesktopAuthListeners();
    window.addEventListener("rearvy-electron-ready", attachDesktopAuthListeners);

    return () => {
      active = false;
      window.clearTimeout(fallbackTimeout);
      window.removeEventListener(
        "rearvy-electron-ready",
        attachDesktopAuthListeners
      );
      unsubscribe();
      unsubscribeDesktopToken?.();
      unsubscribeDesktopCredential?.();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
