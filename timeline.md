# Timeline

A running readable summary of development. Updated at the end of each
session or meaningful milestone. Short enough to read in two minutes.
Deep detail lives in plan.md.

---

## Current Status
*Last updated: 2026-04-17*

**Phase 1 is complete.** Auth + user foundation works on API, mobile,
and web, and every PR now runs through a GitHub Actions CI workflow
(`.github/workflows/ci.yml`) that exercises `go vet`, `go test`,
a `go mod tidy` drift check, workspace-wide TS typecheck, and ESLint
on web + mobile.

Known cosmetic gap on web: the `/home` and `/profile` screens are
narrow (phone-width) because they were built as mobile-style cards
while Figma has no web auth/home designs. Left as-is — Figma wire-up
for web screens comes when Phase 2's real home lands.

Next: **Phase 2 — circle creation + listing**. First real product
entity lands. Scope includes the `circles` and `circle_members`
migrations, create/list/get endpoints with validation and ownership
checks, owner role assignment on creation, a create-circle flow on
mobile, a home screen that lists real circles instead of the
placeholder, and a circle detail shell. Web catches up after mobile.

Deferred still: Expo splash and icon theming (eas build prep),
production Google Cloud OAuth credentials (deploy time), Apple
Sign-In (App Store submission — required when any third-party SSO is
offered).

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

**Step 5d — authenticated API client + `/users/sync` trigger +
profile screen.** First real mobile-to-API round-trip. Extended
`src/lib/api.ts` with a `setTokenGetter` hook so every request pulls
a fresh Clerk JWT and attaches it as `Authorization: Bearer <jwt>` —
we hand the client a lazy getter, not a cached token, because session
tokens rotate within the hour. Split the root layout into
`RootLayout` (which mounts `<ClerkProvider>`) and an inner
`RootContent` that can call `useAuth()` to bind the getter — hooks
can't run in the same component that provides the context they read.

The `(app)` route group layout fires `POST /users/sync` as a fire-and-
forget effect when auth state flips to signed-in, deduped by a
`useRef` keyed on the Clerk user ID and reset on error so a retry
happens on the next render. Home gets a new "View profile" button
alongside sign-out. New `/profile` screen reads `GET /users/me` with
spinner / error-with-retry / fields layout, rendered inside the group
layout's `<Stack>` so it inherits auth protection.

Also updated `packages/types` `User` to match the Go response shape
(added `clerkUserId`, dropped the unused `phoneNumber`, made
`username` and `avatarUrl` optional since both can be absent from
Clerk). Switched `EXPO_PUBLIC_API_URL` to the computer's LAN IP
because Expo Go on a real device can't reach `localhost` on the
machine.

Hit one subtle bug during verification: email/password sign-in synced
cleanly but Google SSO for a new Google account returned "user not
synced yet" on the profile screen with retry not clearing it. Metro
logs showed sync was firing and getting a 401 "invalid or expired
session token" from the API. Added `slog.Warn` to `auth.go` to log
the real `jwt.Verify` error (without the full token), restarted the
API under a claude-managed background process to capture logs, and
on the retry sync returned 200 cleanly. Root cause was a stale JWKS
cache in the long-running API process — Clerk rotates signing keys
and the Go SDK's in-memory JWKS didn't include the key used to sign
the fresh SSO token. The API restart refetched JWKS and fixed it.
Captured in errors.md; learnings.md JWT entry updated with the cache
rotation gotcha. Diagnostic logging in `auth.go` stays — next time
this shape of failure shows up we'll see the exact reason.

End-to-end verified on iPhone: sign in with existing email/password
→ sync 200 → profile loads with email, display name, user ID,
member-since date. Sign out, sign in with Google as a different
user → new row inserted (confirmed via `psql`) → profile shows the
Google account's email and "Kashawn Brown" as display name.

**Step 6a/6b — web Clerk integration + themed prebuilt forms.**
Installed `@clerk/nextjs` (v7.2.3) and `@clerk/themes` (v2.4.57);
bumped `next` 15.2.1 → 15.2.9 to satisfy Clerk's `^15.2.8` peer.
Wrapped the root layout in `<ClerkProvider>` with explicit
`signInUrl`/`signUpUrl` + fallback redirect URLs. Added
`src/middleware.ts` using `clerkMiddleware` + `createRouteMatcher`
to protect `/home(.*)` and `/profile(.*)`. Restructured `app/` into
`(auth)` and `(app)` route groups mirroring mobile; root
`page.tsx` is now a server component that reads `auth()` and
`redirect()`s to `/home` or `/sign-in`.

Auth pages use Clerk's **prebuilt `<SignIn>` and `<SignUp>`**
components on `[[...rest]]` catch-all segments so Clerk can navigate
internally to `/sign-in/factor-one`, `/sign-up/verify-email-address`,
etc. without us hand-wiring sub-routes. Decision to use prebuilts
rather than match Figma (as mobile does): Figma's export has no
auth screens, so there's no design to match — prebuilts themed to
our palette is the right call.

Theming lives in `src/lib/clerkAppearance.ts` — a shared
`Appearance` config with Clerk's `dark` baseTheme as a starting
point plus explicit Tailwind class overrides on every structural
element (card, header, social buttons, form fields, dividers,
footer, alerts, identity preview, OTP cells). First pass used only
`variables` and inherited everything else from `dark` — that wasn't
enough: the card had no visible edges, heading/subtitle were nearly
invisible, inputs were jarring white. Dark theme's element-level
styles win on conflicts, so element class overrides are what
actually take effect.

Hit one middleware gotcha during verification: `/home` redirected
to `https://emerging-shad-23.accounts.dev/sign-in` (Clerk's hosted
portal) instead of our local `/sign-in`. Root cause: middleware
runs before React, so `auth.protect()` doesn't read the
`<ClerkProvider>` `signInUrl` prop. The middleware reads
`NEXT_PUBLIC_CLERK_SIGN_IN_URL` from the environment instead.
Documented both `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in` and
`NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up` in `.env.example`;
added them to `.env.local` and fixed.

Also tightened sign-out UX: `<SignOutButton>` without an explicit
`redirectUrl` defaults to `/`, and the root page's server-side
redirect doesn't fire cleanly through client-side navigation (the
RSC response cached for the signed-in state). Added
`redirectUrl="/sign-in"` on the button so sign-out lands directly
on the sign-in page without a manual refresh.

Apps/web now has a proper `README.md` covering setup, routing, auth,
env vars, and the Tailwind v4 `@source` footgun — was missing
entirely until now.

**Step 6c — authenticated API client + sync + profile on web.**
First real web → API round-trip. Extended `src/lib/api.ts` with the
same `setTokenGetter` pattern mobile uses — a lazy getter, not a
cached token, because Clerk rotates session JWTs within the hour.
Added a small client component `src/components/ApiAuthBridge.tsx`
that calls `useAuth().getToken` inside an effect and hands the
function to the API client. Mounted globally inside `<ClerkProvider>`
so every client component downstream inherits an auth-aware client.

The web inner-component dance is simpler than mobile's: on mobile,
`ClerkProvider` is rendered by the same component that wants
`useAuth()`, so we had to split into `RootLayout` + `RootContent`.
On web, `ClerkProvider` is a Client Component rendered from a
Server Component `layout.tsx` — the bridge can sit anywhere under
the provider without the split.

Added `app/(app)/layout.tsx` (client component) that fires
`POST /users/sync` fire-and-forget on auth state flip, deduped by a
`useRef` keyed on the Clerk user ID. Reset on error so the next
render retries. No belt-and-braces `if (!isSignedIn) redirect` —
the middleware in `src/middleware.ts` already bounces signed-out
users before this layout renders, so the check would be dead code.

Added `/profile` page as a Client Component that reads
`GET /users/me` with spinner / error-with-retry / fields layout
matching mobile's feature set. Styled as a narrow card to match
the rest of the web surface for now.

End-to-end verified in Chrome: sign in with email/password →
Network tab shows `POST /users/sync` 200 followed by
`GET /users/me` 200 → profile renders. Sign out, sign in with
Google → same flow, row confirmed in Postgres. Web `/home` and
`/profile` are narrow (phone-width) because there's no web Figma
to size against — deferred to Phase 2 when the real home screen
arrives.

**Step 7 — CI/CD baseline + ESLint configs.** Phase 1 closer.
Added ESLint flat configs for both apps: `apps/web/eslint.config.mjs`
extends `next/core-web-vitals` + `next/typescript` via `FlatCompat`;
`apps/mobile/eslint.config.mjs` imports from `eslint-config-expo/flat`.
Upgraded web from no ESLint at all to `eslint@^9` +
`eslint-config-next@^15.5.15` (bumped from 15.2.9 because the 15.2
release's `parser.js` required `next/dist/compiled/babel/eslint-parser`,
a path that no longer exists in Next 15.2.9's runtime). Upgraded
mobile from ESLint 8.57 to 9 to match, and pinned `eslint: ^9.39.4`
in the root `overrides` — without the override, `eslint-config-expo`
resolves `require('eslint/config')` against the hoisted root copy of
ESLint, which was 8.57 and doesn't export that subpath. Fourth time
the hoist-wrong-version family has bitten this repo; the rule in
`learnings.md` applied straight through.

Also updated `apps/web/postcss.config.mjs` and
`apps/web/eslint.config.mjs` to bind their default export to a named
`const` first — Next's ESLint rules flag anonymous inline default
exports as a warning.

Added `.github/workflows/ci.yml` with two parallel jobs:
- **api** — checkout, setup-go 1.24 with `go.sum` caching, `go mod
  tidy` drift check (`git diff --exit-code` after tidy), `go vet`,
  `go test ./...`. Tidy drift is a real CI concern — a missing
  `go.sum` entry only shows up when CI builds against a cold cache,
  and catching it in the drift check is cheaper than a mysterious
  build failure.
- **node** — checkout, setup-node 20 with npm cache, `npm ci` at
  root, `npm run typecheck --workspaces --if-present` (runs in web,
  mobile, and types), then `npm run lint --workspaces --if-present`
  (runs in web and mobile; types has no lint script).

Triggers: pull_request targeting main, plus push to main as a
sanity net (so if something sneaks past a PR it still surfaces on
the default branch).

Ran every command locally before wiring the workflow so CI should
pass clean on first run. Root README now documents what CI checks
and how to reproduce it locally. Phase 1 is officially closed —
Phase 2 starts next session.
