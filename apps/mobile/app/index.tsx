import { useAuth } from '@clerk/clerk-expo';
import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

// Entry route "/". Reads Clerk auth state and redirects into the right route
// group. While Clerk is bootstrapping (reading the token cache, refreshing),
// isLoaded is false — we show a spinner instead of flashing either screen.
export default function Index() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  // Declarative redirect — expo-router handles the navigation. No manual
  // useEffect + router.replace dance needed.
  return <Redirect href={isSignedIn ? '/home' : '/sign-in'} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
  },
});
