import { useAuth } from '@clerk/clerk-expo';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/lib/theme';

// Placeholder home screen. Real home (list of circles, ring preview) arrives
// in Phase 2. For now it's a landing pad with a link to the profile screen
// and a sign-out button so we can flip auth state during testing.
export default function HomeScreen() {
  const { signOut } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Home</Text>
        <Text style={styles.subtitle}>
          Signed in. Real home screen arrives in Phase 2.
        </Text>

        <View style={styles.actions}>
          <Link href="/profile" asChild>
            <Pressable
              style={({ pressed }) => [
                styles.buttonOutline,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.buttonText}>View profile</Text>
            </Pressable>
          </Link>

          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={() => signOut()}
          >
            <Text style={styles.buttonText}>Sign out</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  actions: {
    gap: 12,
    width: '100%',
    maxWidth: 320,
    marginTop: 8,
  },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
});
