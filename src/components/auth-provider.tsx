"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User } from "firebase/auth";
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
    const fallbackTimeout = window.setTimeout(() => {
      // Safety guard: never keep the UI blocked indefinitely if auth callback stalls.
      setLoading(false);
    }, 10000);

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

    return () => {
      active = false;
      window.clearTimeout(fallbackTimeout);
      unsubscribe();
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
