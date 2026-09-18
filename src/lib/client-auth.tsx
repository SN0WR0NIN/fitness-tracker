'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth, useClerk } from '@clerk/nextjs';
import type { AppSession } from '@/lib/auth';

type SessionState = {
  data: AppSession | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionState>({
  data: null,
  status: 'loading',
  signOut: async () => {},
});

export function AppSessionProvider({ children, enabled }: { children: React.ReactNode; enabled: boolean }) {
  if (!enabled) {
    return <SessionContext.Provider value={{ data: null, status: 'unauthenticated', signOut: async () => {} }}>{children}</SessionContext.Provider>;
  }
  return <ClerkSessionProvider>{children}</ClerkSessionProvider>;
}

function ClerkSessionProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { signOut: clerkSignOut } = useClerk();
  const [snapshot, setSnapshot] = useState<{ clerkUserId: string; data: AppSession | null } | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) return;

    const controller = new AbortController();
    fetch('/api/auth/session', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => response.ok ? response.json() : null)
      .then((session) => setSnapshot({ clerkUserId: userId, data: session }))
      .catch((error) => {
        if (error instanceof Error && error.name !== 'AbortError') {
          setSnapshot({ clerkUserId: userId, data: null });
        }
      });
    return () => controller.abort();
  }, [isLoaded, isSignedIn, userId]);

  const data = snapshot && snapshot.clerkUserId === userId ? snapshot.data : null;

  const value = useMemo<SessionState>(() => ({
    data,
    status: !isLoaded || (isSignedIn && snapshot?.clerkUserId !== userId)
      ? 'loading'
      : data
        ? 'authenticated'
        : 'unauthenticated',
    signOut: async () => {
      await clerkSignOut({ redirectUrl: '/' });
    },
  }), [clerkSignOut, data, isLoaded, isSignedIn, snapshot?.clerkUserId, userId]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useAppSession() {
  return useContext(SessionContext);
}
