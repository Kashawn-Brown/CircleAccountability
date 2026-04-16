import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// This is the home screen — file is app/index.tsx so it maps to route "/".
// In Phase 1, this will check auth and redirect to sign-in or the real home.
export default function Index() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.title}>Circle Accountability</Text>
        <Text style={styles.subtitle}>Mobile app — Phase 0 shell</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // slate-950
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f8fafc', // slate-50
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8', // slate-400
  },
});
