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
    let unsubscribe = () => {};
    let unsubscribeDesktopToken: (() => void) | undefined;
    let unsubscribeDesktopCredential: (() => void) | undefined;
    let desktopAuthAttached = false;
    const fallbackTimeout = window.setTimeout(() => {
      // Safety guard: never keep the UI blocked indefinitely if auth callback stalls.
      setLoading(false);
    }, 10000);

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
            console.error("Failed to sign in with desktop auth token:", error);
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
              console.error(
                "Failed to sign in with desktop auth credential:",
                error
              );
            });
          }
        );
      }
    };

    const initializeAuth = async () => {
      try {
        await auth.authStateReady();
      } catch (error) {
        console.error("Failed to wait for Firebase auth state:", error);
      }

      if (!active) {
        return;
      }

      setUser(auth.currentUser);
      setLoading(false);
      window.clearTimeout(fallbackTimeout);

      unsubscribe = onAuthChange((nextUser) => {
        setUser(nextUser);
        setLoading(false);
      });
    };

    void initializeAuth();
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
