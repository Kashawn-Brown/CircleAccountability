'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useRef } from 'react';

import { api } from '@/lib/api';

// Layout for the (app) route group: all protected, authenticated screens.
// Mirrors apps/mobile/app/(app)/_layout.tsx.
//
// Fires POST /users/sync once per signed-in user as a fire-and-forget
// effect — this is what materializes the local Postgres users row from
// Clerk's profile. Sync is a single upsert on the backend (~200ms) so
// screens render normally while it's in flight. If sync fails, the ref
// is cleared so a retry can happen on the next render (and the profile
// screen surfaces the "not synced yet" error with a retry button).
//
// Route-level auth protection is already enforced by middleware.ts —
// middleware redirects signed-out users to /sign-in before this layout
// renders. So we don't need the belt-and-braces `if (!isSignedIn)
// redirect` that mobile has, because mobile doesn't have middleware.
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isSignedIn, userId } = useAuth();
  const syncedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isSignedIn || !userId) return;
    if (syncedRef.current === userId) return;
    syncedRef.current = userId;
    api.post('/api/v1/users/sync', {}).catch((err) => {
      console.warn('Initial /users/sync failed:', err);
      syncedRef.current = null;
    });
  }, [isSignedIn, userId]);

  return <>{children}</>;
}
