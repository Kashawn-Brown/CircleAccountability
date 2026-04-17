import { useSignUp } from '@clerk/clerk-expo';
import { Link } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoogleSSOButton } from '@/components/GoogleSSOButton';
import { colors } from '@/lib/theme';

// Sign-up screen. Two-stage flow inside one component:
//   'form'   — collect email + password, create signUp resource, ask Clerk
//              to send the verification code
//   'verify' — collect the code the user received, call attempt...
//              Verification, setActive on success
// On success, the (auth)/_layout redirect handles navigation to /home.
export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const [stage, setStage] = useState<'form' | 'verify'>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Stage 1: create the signUp and trigger the verification email.
  const onCreateAccount = async () => {
    if (!isLoaded) return;
    setError(null);
    setSubmitting(true);
    try {
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setStage('verify');
    } catch (err: unknown) {
      setError(clerkError(err, 'Could not create account.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Stage 2: submit the 6-digit code from the user's email.
  const onVerifyCode = async () => {
    if (!isLoaded) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        // Auth state flips; (auth)/_layout redirects to /home.
      } else {
        setError('Verification incomplete. Double-check the code.');
      }
    } catch (err: unknown) {
      setError(clerkError(err, 'Verification failed.'));
    } finally {
      setSubmitting(false);
    }
  };

  const onUseDifferentEmail = () => {
    setStage('form');
    setError(null);
    setCode('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Circle Accountability</Text>
            <Text style={styles.subtitle}>
              {stage === 'form' ? 'Create account' : 'Check your email'}
            </Text>
          </View>

          {stage === 'form' ? (
            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={colors.textFaint}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                editable={!submitting}
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={colors.textFaint}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                value={password}
                onChangeText={setPassword}
                editable={!submitting}
              />

              {error && <Text style={styles.error}>{error}</Text>}

              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  (pressed || submitting) && styles.buttonPressed,
                ]}
                onPress={onCreateAccount}
                disabled={submitting || !isLoaded}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <Text style={styles.buttonText}>Create account</Text>
                )}
              </Pressable>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              <GoogleSSOButton disabled={submitting} onError={setError} />

              <View style={styles.footer}>
                <Text style={styles.footerText}>Already have an account? </Text>
                <Link href="/sign-in" style={styles.footerLink}>
                  Sign in
                </Link>
              </View>
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.helpText}>
                We sent a 6-digit code to {email}. Enter it below to finish
                creating your account.
              </Text>
              <TextInput
                style={styles.input}
                placeholder="123456"
                placeholderTextColor={colors.textFaint}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                value={code}
                onChangeText={setCode}
                editable={!submitting}
                maxLength={6}
              />

              {error && <Text style={styles.error}>{error}</Text>}

              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  (pressed || submitting) && styles.buttonPressed,
                ]}
                onPress={onVerifyCode}
                disabled={submitting || !isLoaded}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <Text style={styles.buttonText}>Verify</Text>
                )}
              </Pressable>

              <Pressable
                onPress={onUseDifferentEmail}
                disabled={submitting}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>
                  Use a different email
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Extract a Clerk-style error message, falling back to a generic string.
function clerkError(err: unknown, fallback: string): string {
  const e = err as { errors?: { longMessage?: string; message?: string }[]; message?: string };
  return e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? e?.message ?? fallback;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: 'center',
    gap: 32,
  },
  header: {
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
  },
  form: {
    gap: 12,
  },
  helpText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  input: {
    backgroundColor: colors.bgElevated,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    paddingHorizontal: 4,
  },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  secondaryButtonText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  footerLink: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
});
