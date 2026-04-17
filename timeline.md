# Timeline

A running readable summary of development. Updated at the end of each
session or meaningful milestone. Short enough to read in two minutes.
Deep detail lives in plan.md.

---

## Current Status
*Last updated: 2026-04-17*

Phase 1 is partway through — steps 1 to 3 of 9 complete on the backend
side. Clerk application exists with email/password and Google sign-in
enabled on the dev instance. Env vars split per app (root `.env.local`
for the API, per-app files for Next.js and Expo). `users` table exists
in Postgres via migration `000002`, bridged to Clerk via a
`clerk_user_id` column. A Go Auth middleware verifies Clerk session
JWTs (via `clerk-sdk-go/v2`) and attaches the authenticated user ID to
the request context; protected routes are mounted under `/api/v1`.
Air hot reload is configured (`make dev`) alongside the plain
`make run`. Temporary `GET /api/v1/me/ping` verifies the middleware
end-to-end with curl.

Next step: **step 4 — `POST /users/sync` and `GET /users/me`** — turn
the Clerk user ID in the request context into a real row in the
`users` table on first sign-in, and read it back.

Deferred from Phase 0, still outstanding: ESLint configs for web and
mobile. These land before CI at the end of Phase 1.

Branch: phase-1/auth

---

## Phase 0 — Project Setup
*April 2026*

Repo initialized as a Turborepo monorepo with apps/ (api, web, mobile)
and packages/ (types). Stack locked: Expo SDK 54 + React Native 0.81 +
TypeScript for mobile, Next.js 15 App Router + TypeScript for web,
Go 1.23 + chi + pgx + Postgres for the API, Clerk for auth (Phase 1),
GCP Cloud Run + Neon for hosting later.

Doc files seeded (plan, timeline, learnings, decisions, errors,
challenges). All three apps verified to boot:

- **API**: after fixing a Makefile shell bug that truncated
  `DATABASE_URL` at the first `=`, a dual-Postgres port collision on
  5432, a port 8080 collision with MiniTool ShadowMaker, a partial
  `go.sum` from the scaffold, and driver-specific SSL behavior.
- **Web**: after adding a missing `postcss.config.mjs` and an explicit
  `@source` directive in `globals.css` so Tailwind v4 scans our `.tsx`
  files inside the Turborepo subdirectory.
- **Mobile**: after upgrading Expo SDK 53 → 54 (which cascaded into
  React 18 → 19, React Native 0.76 → 0.81, expo-router 4 → 6, types
  updates, and eslint-config-expo 8 → 10), and adding root-level
  `overrides` to force `react` and `@types/react` to the exact
  versions React Native's renderer requires.

All Phase 0 issues are captured in errors.md. Key pattern established
for this monorepo: use `overrides` in the root `package.json` for any
package that needs to be version-locked across workspaces — npm
hoisting otherwise picks the highest compatible version, which can
diverge from what a specific workspace pinned.

## Phase 1 — Auth + user foundation
*April 2026*

**Step 1 — Clerk application setup.** Created a Clerk dev instance with
email/password plus Google social connection (using Clerk's shared
dev Google OAuth credentials — production will need our own). Split
env files per app to match how each tool loads them natively: the Go
API reads the root `.env.local` via godotenv, Next.js auto-loads from
`apps/web/.env.local`, Expo auto-loads from `apps/mobile/.env.local`.
Root `.env.example` now documents API vars only; each frontend gets
its own `.env.example`.

**Step 2 — `users` table migration.** `000002_users.up.sql` creates
the app-side identity row. UUID primary key, `clerk_user_id` (text,
unique) as the bridge to Clerk, `email` and `username` as `citext`
for case-insensitive uniqueness, partial unique index on `username`
to allow multiple NULLs, and a shared `set_updated_at()` trigger
function that's reused on every future table with an `updated_at`
column. The trigger function is intentionally left in place on
rollback — it's a shared schema utility.

**Step 3 — Go auth middleware.** `github.com/clerk/clerk-sdk-go/v2`
pulled in. `clerk.SetKey` initialized once at startup; `CLERK_SECRET_KEY`
added to config with fail-fast validation. `internal/middleware/auth.go`
verifies the `Authorization: Bearer <jwt>` header via `jwt.Verify`,
pulls the `sub` claim (Clerk user ID), and attaches it to the request
context under a private `ctxKey`. `ClerkUserIDFromContext` helper reads
it back so handlers don't know the key type. Protected routes mount
under `/api/v1` behind `Auth`; `/health` stays public. A temporary
`GET /api/v1/me/ping` endpoint echoes the Clerk user ID for smoke
testing — to be replaced by `/users/me` in step 4.

Side quest during step 3: added **Air** for Go hot reload. `make dev`
uses Air; `make run` kept as the dep-free one-shot. `.air.toml` lives
next to the `Makefile`, so Air runs from the same cwd as `make run`
and `godotenv.Load("../../.env.local")` still resolves correctly.

All three smoke tests pass: `/health` → 200, unauthenticated `/me/ping`
→ 401 with `missing or malformed Authorization header`, bad-token
`/me/ping` → 401 with `invalid or expired session token`. Positive-
path test with a real Clerk JWT waits until mobile sign-in works (step
5 or later).
