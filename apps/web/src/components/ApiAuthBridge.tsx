'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect } from 'react';

import { api } from '@/lib/api';

// Binds Clerk's useAuth().getToken to the singleton API client at app start.
// Lives inside <ClerkProvider> in app/layout.tsx so useAuth() has context.
// Renders nothing — side-effect only.
//
// The getter is lazy: we hand the client a function, not a cached token,
// so every request pulls a fresh JWT. Clerk rotates session tokens on its
// own schedule (minutes) and refreshes them in the background, so a
// cached copy would go stale.
export function ApiAuthBridge() {
  const { getToken } = useAuth();

  useEffect(() => {
    api.setTokenGetter(async () => await getToken());
  }, [getToken]);

  return null;
}
