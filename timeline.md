# Timeline

A running readable summary of development. Updated at the end of each
session or meaningful milestone. Short enough to read in two minutes.
Deep detail lives in plan.md.

---

## Current Status
*Last updated: 2026-04-17*

Phase 1 is ~5 of 9 steps deep. Backend endpoints and middleware done
earlier; on top of that, **mobile step 5a** now has the structural
wiring: `ClerkProvider` at the root, Secure-Store token cache, route
groups `(auth)` / `(app)` with layouts that route by Clerk auth state,
placeholder sign-in and home screens. Verified on iPhone via Expo Go
— app boots, spinner flashes while Clerk loads, lands on the sign-in
placeholder on the slate background.

Next step: **step 5b — real email/password sign-in and sign-up**
with the Clerk hooks (`useSignIn`, `useSignUp`), including the email
verification code flow. After that, 5c is Google OAuth, and 5d wires
the authenticated API client + `/users/sync` on sign-in success.

Deferred still: ESLint configs for web and mobile (Phase 0 carryover,
land before CI). Also deferred to eas build time: Expo splash and
icon theming — default assets for now.

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

**Step 5a — mobile ClerkProvider + route groups + placeholders.**
Installed `@clerk/clerk-expo` and `expo-secure-store`. Wrote a Secure
Store-backed token cache at `src/lib/tokenCache.ts` (encrypted via iOS
Keychain / Android Keystore — never AsyncStorage for session tokens).
Wrapped the root layout in `<ClerkProvider>`. Replaced the Phase 0
spinner index with an auth-state router that uses `useAuth()` and
`<Redirect>` to send traffic to `(auth)/sign-in` or `(app)/home`.
Split the app into two route groups: `(auth)` for public screens,
`(app)` for protected screens, each with a layout that re-checks auth
state as belt-and-braces. Placeholder sign-in and home screens (home
has a sign-out button so we can flip auth state while testing later
sub-steps).

Hit one runtime error before verification: `Cannot find native module
'ExpoCryptoAES'` when Clerk's `useSSO` loaded `expo-auth-session`,
which loaded `expo-crypto/aes`, which tried to bind a native module
Expo Go SDK 54 doesn't have. Root cause: Clerk's peer deps are very
loose (`expo-crypto >=12`) and npm had satisfied them with SDK 55
versions of the packages (`55.x`) instead of the SDK 54 versions our
Expo Go supports (`15.x` / `7.x`). Fixed by adding explicit root
`overrides` for `expo-crypto`, `expo-auth-session`, `expo-web-browser`,
`expo-application`, `expo-constants`, `expo-linking` pinned to their
SDK 54 versions, plus making those packages explicit direct deps in
`apps/mobile/package.json`. Nuked `node_modules` + `package-lock.json`
and reinstalled. Captured in errors.md; generalized to a rule in
learnings.md (third time the hoist-wrong-version family has bitten
this repo). Verified after fix: spinner → sign-in placeholder, no
crashes.

Also created `apps/mobile/README.md` — was missing since Phase 0.
