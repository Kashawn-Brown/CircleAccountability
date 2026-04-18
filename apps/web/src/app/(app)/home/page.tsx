'use client';

import { SignOutButton } from '@clerk/nextjs';
import Link from 'next/link';

// Placeholder home screen. Real home (list of circles + ring preview)
// arrives in Phase 2. For now it's a landing pad that proves auth works
// — a link to the profile page and a sign-out button.
export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Home</h1>
          <p className="text-slate-400 text-sm">
            Signed in. Real home screen arrives in Phase 2.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/profile"
            className="rounded-lg border border-slate-800 py-3 hover:bg-slate-900"
          >
            View profile
          </Link>
          <SignOutButton redirectUrl="/sign-in">
            <button className="rounded-lg bg-emerald-600 hover:bg-emerald-500 py-3 font-semibold">
              Sign out
            </button>
          </SignOutButton>
        </div>
      </div>
    </main>
  );
}
