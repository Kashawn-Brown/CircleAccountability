import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

// Root route — a server-side gate that routes by auth state:
// - Signed in → /home
// - Not signed in → /sign-in
// This is a Server Component (no "use client"), so the redirect happens
// before the browser ever sees a spinner. Middleware already protects
// /home, but routing here avoids a double-redirect when a signed-in user
// lands on /.
export default async function IndexPage() {
  const { userId } = await auth();
  redirect(userId ? '/home' : '/sign-in');
}
