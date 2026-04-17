import { useAuth } from '@clerk/clerk-expo';
import { Redirect, Stack } from 'expo-router';

// Layout for the (auth) route group: sign-in, sign-up, verification screens.
// Route groups — folders wrapped in parentheses — share a layout without
// appearing in the URL. Our sign-in screen is at app/(auth)/sign-in.tsx and
// its URL is just "/sign-in".
//
// If a signed-in user somehow lands here (e.g. deep link), bounce them to
// home. The root index.tsx already routes based on auth, so this is a
// belt-and-braces check.
export default function AuthLayout() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return null;
  if (isSignedIn) return <Redirect href="/home" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
