import { SignUp } from '@clerk/nextjs';

import { clerkAppearance } from '@/lib/clerkAppearance';

// Clerk's prebuilt <SignUp /> handles credential entry, email verification
// code, and Google OAuth — mirrors <SignIn /> on the same catch-all pattern.
export default function SignUpPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <SignUp appearance={clerkAppearance} />
    </main>
  );
}
