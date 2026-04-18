import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';

import { ApiAuthBridge } from '@/components/ApiAuthBridge';

import './globals.css';

export const metadata: Metadata = {
  title: 'Circle Accountability',
  description: 'Complete the circle together.',
};

// ClerkProvider wraps the whole app so any client component can read auth
// state via hooks (useAuth, useUser, etc.). The sign-in/up URL props tell
// Clerk's prebuilt components and middleware.auth.protect() where to send
// unauthenticated visitors; the fallback redirect URLs define where to
// land after a successful sign-in or sign-up.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/home"
      signUpFallbackRedirectUrl="/home"
    >
      <html lang="en" className="dark">
        <body className="bg-slate-950 text-slate-50 antialiased">
          <ApiAuthBridge />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
