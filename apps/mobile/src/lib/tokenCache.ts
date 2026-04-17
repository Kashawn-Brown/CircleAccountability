// src/lib/tokenCache.ts
// Token cache for Clerk. Clerk hands us opaque strings (session tokens and
// their keys) and asks us to persist them across app restarts. We store them
// encrypted via expo-secure-store, which maps to the iOS Keychain and the
// Android Keystore. Do NOT use AsyncStorage here — it's unencrypted.

import * as SecureStore from 'expo-secure-store';

export const tokenCache = {
  async getToken(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      // A corrupted or missing entry shouldn't crash the app — returning null
      // makes Clerk treat it as "no cached token, start fresh."
      return null;
    }
  },
  async saveToken(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // Swallow — Clerk will retry on its next token refresh.
    }
  },
};
