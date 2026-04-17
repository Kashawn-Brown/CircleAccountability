import { useAuth } from '@clerk/clerk-expo';
import { Redirect, Stack } from 'expo-router';

// Layout for the (app) route group: all protected, authenticated screens.
// If a signed-out user somehow lands here, bounce them to the sign-in screen.
// Together with (auth)/_layout.tsx this gives us a hard split: screens under
// (auth) are only visible when signed OUT, screens under (app) are only
// visible when signed IN.
export default function AppLayout() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/sign-in" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
