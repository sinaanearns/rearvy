"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User } from "firebase/auth";
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
    const fallbackTimeout = window.setTimeout(() => {
      // Safety guard: never keep the UI blocked indefinitely if auth callback stalls.
      setLoading(false);
    }, 10000);

    const unsubscribe = onAuthChange((user) => {
      window.clearTimeout(fallbackTimeout);
      setUser(user);
      setLoading(false);
    });

    return () => {
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
