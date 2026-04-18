import { SignIn } from '@clerk/nextjs';

import { clerkAppearance } from '@/lib/clerkAppearance';

// Clerk's prebuilt <SignIn /> renders email/password, the Google OAuth
// button (automatic because Google is enabled on this Clerk instance),
// forgotten-password flow, and any sub-paths it needs (factor-two,
// verify-email-address, etc.) — the [[...rest]] catch-all in the folder
// name is what lets it navigate to those sub-paths in place.
export default function SignInPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <SignIn appearance={clerkAppearance} />
    </main>
  );
}
