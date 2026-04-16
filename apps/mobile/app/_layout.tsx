import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

// This is the root layout for the entire app.
// Expo Router uses file-based routing (like Next.js App Router) —
// every file in the /app directory becomes a route automatically.
export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0f172a' }, // slate-950
        }}
      />
    </>
  );
}
