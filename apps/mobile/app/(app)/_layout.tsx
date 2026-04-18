import { useAuth } from '@clerk/clerk-expo';
import { Redirect, Stack } from 'expo-router';
import { useEffect, useRef } from 'react';

import { api } from '@/lib/api';

// Layout for the (app) route group: all protected, authenticated screens.
// If a signed-out user somehow lands here, bounce them to the sign-in screen.
//
// Also fires POST /users/sync once per signed-in user as a fire-and-forget
// effect — this is what materializes the local Postgres users row from
// Clerk's profile. Sync is a single upsert on the backend (~200ms) so the
// home screen renders normally while it's in flight. If sync fails, the
// ref is cleared so a retry can happen on the next render (and the profile
// screen surfaces the "not synced yet" error with a retry button).
export default function AppLayout() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const syncedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isSignedIn || !userId) return;
    if (syncedRef.current === userId) return; // already synced for this user
    syncedRef.current = userId; // claim immediately to dedupe rapid remounts
    api.post('/api/v1/users/sync', {}).catch((err) => {
      console.warn('Initial /users/sync failed:', err);
      syncedRef.current = null; // allow retry on next render
    });
  }, [isSignedIn, userId]);

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/sign-in" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
