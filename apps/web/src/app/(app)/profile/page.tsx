'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import type { User } from '@circle/types';

import { api } from '@/lib/api';

// Profile page. Reads GET /users/me and displays the local users row.
// Mirrors apps/mobile/app/(app)/profile.tsx in feature set.
//
// Handles the rare race where the user navigates here before the
// (app)/layout has finished its fire-and-forget /users/sync — the
// backend returns "user not synced yet" which we show with a retry button.
export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await api.get<User>('/api/v1/users/me');
      setUser(me);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e?.message ?? 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="w-full max-w-md mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Profile</h1>
          <Link
            href="/home"
            className="text-sm text-emerald-500 hover:text-emerald-400"
          >
            ← Home
          </Link>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-500" />
          </div>
        )}

        {error && !loading && (
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-5 space-y-4">
            <p className="text-red-400 text-sm text-center">{error}</p>
            <button
              onClick={load}
              className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 py-2.5 text-sm font-semibold"
            >
              Retry
            </button>
          </div>
        )}

        {user && !loading && (
          <div className="space-y-5">
            <Field label="Display name" value={user.displayName} />
            <Field label="Email" value={user.email} />
            <Field label="Username" value={user.username ?? '—'} />
            <Field label="User ID" value={user.id} mono />
            <Field
              label="Member since"
              value={new Date(user.createdAt).toLocaleDateString()}
            />
          </div>
        )}
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div
        className={
          mono
            ? 'font-mono text-sm text-slate-50 break-all'
            : 'text-base text-slate-50'
        }
      >
        {value}
      </div>
    </div>
  );
}
