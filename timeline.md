# Timeline

A running readable summary of development. Updated at the end of each
session or meaningful milestone. Short enough to read in two minutes.
Deep detail lives in plan.md.

---

## Current Status
*Last updated: 2026-04-17*

Phase 1 is 7 of 9 steps deep. Mobile auth surface is now fully
functional — email/password sign-in, sign-up with email verification,
sign-out, and Google OAuth via Clerk's `useSSO` hook. Tap Continue
with Google → system browser opens → consent on Google → redirects
back via the `circle://` URL scheme → land on /home. Same flow
whether the Google account is new (Clerk auto-creates a user) or
already linked (signs in to existing). Cancellation in the browser
is silent by design.

Next step: **5d — authenticated API client + `/users/sync` on
sign-in success + minimal profile screen**. This is the first time
the mobile app talks to our Go backend: extend `src/lib/api.ts` to
attach the Clerk session JWT, call `POST /users/sync` once after
sign-in to materialize the local users row, and read `GET /users/me`
on the profile screen. Also need to switch `EXPO_PUBLIC_API_URL`
from `localhost` to your computer's LAN IP since Expo Go on a real
device can't reach `localhost`.

Deferred still: ESLint configs (Phase 0 carryover), Expo splash and
icon theming (eas build prep), production Google Cloud OAuth
credentials (deploy time), Apple Sign-In (App Store submission —
required when any third-party SSO is offered).

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

**Step 5b — email/password sign-in, sign-up, and sign-out.** Extracted
a central palette to `src/lib/theme.ts` (slate bg, emerald accent,
red danger, etc.) and migrated every existing screen onto it before
adding new screens, so the next two phases of UI growth pay one
import cost instead of duplicating hex codes. Replaced the
placeholder sign-in with a real form using `useSignIn` — single-shot
`signIn.create` with identifier + password, then `setActive` on
`status === 'complete'`. The `(auth)/_layout` redirect handles
navigation to `/home` automatically when auth state flips.

Sign-up is a single component with two stages held in local state.
Stage 1 (`form`) calls `signUp.create` + `prepareEmailAddressVeri-
fication({ strategy: 'email_code' })` to send the 6-digit code.
Stage 2 (`verify`) calls `attemptEmailAddressVerification({ code })`
and `setActive` on completion. A "Use a different email" button on
the verify stage resets back to the credentials form. KeyboardAvoid-
ingView keeps the inputs visible on small screens; inputs disable
and the button shows a spinner while requests are in flight.

Clerk errors flow through a small `clerkError` helper that pulls
`err.errors[0].longMessage` with fallbacks — verified for wrong
password, breached-password rejection (Clerk's default policy is
length + HaveIBeenPwned, not complexity rules — captured in
`learnings.md`), and wrong/expired verification codes. All paths
tested on iPhone end-to-end: sign in as the existing test user,
sign out (session cleared from Secure Store), sign up a new user
with a real inbox to receive the verification code, all errors
visible.

**Step 5c — Google OAuth.** Added a shared `GoogleSSOButton`
component used by both sign-in and sign-up. It owns the Clerk
`useSSO` hook, the `AuthSession.makeRedirectUri({ scheme: 'circle' })`
call, and `WebBrowser.maybeCompleteAuthSession()` at module load
(must run top-level so the OAuth round-trip can resolve when
iOS/Android spins up a fresh JS instance to handle the redirect —
captured in learnings.md). Outlined button styling so it visually
defers to the primary email form button above; "G" mark via
Ionicons (will swap to Google's official branded button before App
Store submission).

UI lays out a `─── or ───` divider between the email form and the
Google button on both screens. Sign-up's verify stage doesn't show
the Google button — Google flow doesn't need email verification.

Verified on iPhone: Google sign-in from both screens completes the
in-app browser round-trip and lands on /home. Cancellation (close
the browser) is silent — no error row shown, by design. Confirmed
in the Clerk dashboard that the test Google account appears as a
linked external account on the Clerk user. Production Google Cloud
OAuth credentials deferred to deploy time, and Apple Sign-In
deferred to App Store submission (both captured in decisions.md).
