import { useAuth } from '@clerk/clerk-expo';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Placeholder home screen. Real home (list of circles, ring preview) arrives
// in Phase 2. The sign-out button is here now so we can flip auth state
// while testing steps 5a through 5d.
export default function HomeScreen() {
  const { signOut } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Home</Text>
        <Text style={styles.subtitle}>
          Signed in. Real home screen arrives in Phase 2.
        </Text>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={() => signOut()}
        >
          <Text style={styles.buttonText}>Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
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
    color: '#f8fafc',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#059669',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '600',
  },
});
