# Timeline

A running readable summary of development. Updated at the end of each
session or meaningful milestone. Short enough to read in two minutes.
Deep detail lives in plan.md.

---

## Current Status
*Last updated: 2026-04-17*

Phase 1 backend side is effectively done — steps 1 to 4 of 9
complete. On top of the Clerk integration, users table, and Auth
middleware from the earlier commit, we now have real endpoints behind
the middleware: `POST /api/v1/users/sync` (upserts the local users
row from Clerk's profile on sign-in) and `GET /api/v1/users/me`
(reads the local row). Code is organized with a new `internal/repo`
package so SQL lives separately from HTTP handlers; the `users` repo
exposes `UpsertByClerkID` and `GetByClerkID`. End-to-end verification
ran today with a real Clerk JWT: 401 without a token, 404 before
sync, 200 on sync with INSERT path, 200 on `/me` after sync, second
sync returns the same id with an advanced `updated_at`, and the row
is visible in Postgres via psql.

Next step: **step 5 — mobile Clerk integration**. Wire
`@clerk/clerk-expo`, build the sign-up / sign-in / sign-out screens
matching the Figma, persist the session, and call `/users/sync` on
sign-in success so a real phone drives the backend we just built.

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

**Step 4 — `/users/sync` and `/users/me`.** New `internal/repo` package
holds SQL; `repo/users.go` exposes `UpsertByClerkID` (INSERT ... ON
CONFLICT DO UPDATE ... RETURNING) and `GetByClerkID` (sentinel
`ErrNotFound` on `pgx.ErrNoRows`). `handler/users.go` reads the Clerk
user ID from request context (set by Auth), calls `user.Get` on the
Clerk SDK for the real email/name/avatar — server is source of truth,
client is never trusted for identity — and upserts via the repo.
Nullable columns modeled as `*string` so SQL NULL round-trips through
pgx and JSON correctly. `display_name` falls back Clerk first/last →
Clerk username → email local-part so the NOT NULL column always has
a value. `GET /users/me` returns 404 with a specific "not synced yet"
message if a client hits it before sync. Temporary `/me/ping` retired;
`handler/me.go` deleted.

Verified end-to-end today with a real JWT grabbed via the Clerk
account portal (Frontend API host decoded from the publishable key).
404 → sync 200 (INSERT) → me 200 → sync 200 (UPDATE, same id, later
updated_at). Row confirmed in Postgres via `psql`.
