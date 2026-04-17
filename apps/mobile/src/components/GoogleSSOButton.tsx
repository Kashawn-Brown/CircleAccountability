import { useSSO } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/lib/theme';

// Required for the SSO redirect to be picked up when the in-app browser
// dismisses. MUST run at module load (top-level) — not inside the
// component or a hook — because iOS/Android may spin up a fresh JS
// instance to handle the redirect, and that instance needs to know an
// auth session is in progress before any rendering happens.
WebBrowser.maybeCompleteAuthSession();

type Props = {
  disabled?: boolean;
  onError?: (msg: string) => void;
};

// Shared "Continue with Google" button used by sign-in and sign-up. Owns
// the Clerk useSSO flow so screens don't duplicate it. On success, calls
// setActive and lets the (auth)/_layout redirect handle navigation.
//
// Same flow whether the Google account is new or already linked: Clerk
// signs in an existing user or auto-creates one. createdSessionId is
// populated either way unless our Clerk config requires extra fields the
// Google profile can't supply (it doesn't, currently).
export function GoogleSSOButton({ disabled, onError }: Props) {
  const { startSSOFlow } = useSSO();
  const [submitting, setSubmitting] = useState(false);

  const onPress = async () => {
    setSubmitting(true);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: AuthSession.makeRedirectUri({ scheme: 'circle' }),
      });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        // Auth state flips; (auth)/_layout redirects to /home.
      }
      // No createdSessionId means the user cancelled in the browser, or
      // Clerk needs more info to finish sign-up. Cancellation is silent
      // by design — no error to show.
    } catch (err: unknown) {
      onError?.(clerkError(err, 'Google sign-in failed.'));
    } finally {
      setSubmitting(false);
    }
  };

  const isDisabled = submitting || disabled;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        pressed && !isDisabled && styles.buttonPressed,
        isDisabled && styles.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={isDisabled}
    >
      {submitting ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <View style={styles.row}>
          <Ionicons name="logo-google" size={18} color={colors.text} />
          <Text style={styles.text}>Continue with Google</Text>
        </View>
      )}
    </Pressable>
  );
}

// Extract a Clerk-style error message, falling back to a generic string.
function clerkError(err: unknown, fallback: string): string {
  const e = err as { errors?: { longMessage?: string; message?: string }[]; message?: string };
  return e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? e?.message ?? fallback;
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonPressed: {
    backgroundColor: colors.bgElevated,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  text: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
});
