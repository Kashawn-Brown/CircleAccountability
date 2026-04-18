import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { api } from '@/lib/api';
import { colors } from '@/lib/theme';
import { tokenCache } from '@/lib/tokenCache';

// Clerk's publishable key is safe to inline in the client bundle — it only
// identifies this Clerk app. EXPO_PUBLIC_ prefix is required for Expo to
// expose the variable at runtime.
const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY — set it in apps/mobile/.env.local',
  );
}

// Root layout for the whole app. ClerkProvider wraps everything so any screen
// can read auth state via hooks (useAuth, useUser, useSignIn, etc.).
// File-based routing via expo-router: every file under /app is a route.
export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <RootContent />
    </ClerkProvider>
  );
}

// Inner component so we can call useAuth() — hooks can't run at the same
// level as the provider that supplies them. Binds the API client to Clerk's
// session token getter so every authenticated request automatically carries
// a fresh JWT without each call site plumbing it in.
function RootContent() {
  const { getToken } = useAuth();

  useEffect(() => {
    api.setTokenGetter(async () => await getToken());
  }, [getToken]);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
    </>
  );
}
