import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase/client';
import type { User } from 'firebase/auth';

/**
 * Hook to get current authenticated user
 */
export function useAuthContext() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is in browser (not SSR)
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return { user, loading };
}
