# Decisions

Architectural and technical choices with reasoning. The point of this
file is to prevent relitigating things already decided.

---

## Mobile-first with web support
*Phase 0*

Mobile is the primary surface. Web follows. Each phase is completed on
mobile before web catches up.

Reason: the product is for small groups checking in throughout the day
— a phone in hand is the realistic use case. Building web-first risks
shaping the product around a less important surface.

---

## One backend, one database, no microservices
*Phase 0*

A single Go HTTP API backed by a single Postgres database. No service
decomposition.

Reason: MVP scope is small enough that microservices add operational
cost without value. Easier to reason about, deploy, and load-test as
one system. Scale concerns can be addressed later if they materialize.

---

## Stack lock
*Phase 0*

- Mobile: Expo SDK 54 + React Native 0.81 + TypeScript
- Web: Next.js 15 App Router + TypeScript + Tailwind CSS v4
- Backend: Go 1.23 + chi + pgx
- Database: PostgreSQL (managed on Neon in production)
- Auth: Clerk
- Migrations: golang-migrate
- Monorepo: Turborepo + npm

Reason: balances real product path (App Store, Play Store, real
deployment), learning value (Go backend with hand-rolled Postgres
instead of Firebase), and controlled complexity (managed auth and DB,
no microservices).

---

## Shared TypeScript types in packages/types
*Phase 0*

API request/response contracts live in `packages/types/src/index.ts`
and are consumed by both mobile and web. Go business logic stays in
`internal/` and is not shared across the language boundary — TS clients
consume the wire contract only.

Reason: avoids fake-DRY across languages. Only the wire contract needs
to be shared; business rules belong in the server.

---

## API response shape: `{ data: T }`
*Phase 0*

All API responses wrap payload in `{ data: T }`. Error shape to be
finalized alongside the first real endpoints.

Reason: a consistent envelope makes client parsing predictable and
leaves room to add metadata (pagination, request IDs, warnings)
without changing every call site later.

---

## Note-based check-ins first, photo proof deferred
*Phase 0 / MVP scope*

`CheckInAttachment` is in the data model but photo uploads are out of
MVP. Note-only check-ins in the first build.

Reason: file storage adds real infrastructure (signed URLs, GCS,
permissions, moderation edge cases) and isn't required to prove the
core loop. If the loop isn't compelling with notes, photos won't save it.

---

## CI/CD deferred to end of Phase 1
*Phase 0*

No GitHub Actions workflow yet. Added at the end of Phase 1 once auth
is in place. Will run `go vet` + Go tests + TS typecheck + lint on
every PR targeting main.

Reason: nothing meaningful to test in Phase 0. Code is structured from
the start to stay CI-friendly (no tricks that would make CI harder to
add later).

---

## Main branch protected, feature branches only
*Phase 0*

All work happens on branches named `phase-N/short-description`. Main
is protected. All changes to main go through PRs on GitHub.

Reason: preserves a clean history and prevents accidental direct
pushes. Matches how the user operates (GitHub Desktop, manual merges).

---

## Local Postgres connects with `sslmode=disable`
*Phase 0*

`DATABASE_URL` in local dev includes `?sslmode=disable`. The Docker
Postgres container runs without SSL, which is standard for localhost-
to-localhost dev traffic. The `pq` driver (used by `golang-migrate`)
defaults to requiring SSL and refuses to connect without it; `pgx`
(used by the API) is more lenient but accepts the param too.

Reason: both drivers accept `sslmode=disable`, so one value keeps the
API and migrations consistent. In production on Neon/Cloud SQL, this
should be `sslmode=require`.

---

## API port is 8090 in development
*Phase 0*

The Go API listens on port 8090 locally (`.env.local`, `.env.example`,
`config.go` fallback, and the mobile/web `api.ts` fallbacks all
agree).

Reason: port 8080 collided with MiniTool ShadowMaker's
`MTAgentService`, which is actively used for scheduled backups.
Moving our port was cleaner than disabling a real backup agent. Port
8090 is just as conventional for dev and carries no production
implications — Cloud Run injects its own `PORT` env var at runtime,
overriding whatever the local default is.

---

## Root `overrides` for cross-workspace version locking
*Phase 0*

When a package is used by more than one workspace and the workspaces
pin different versions or ranges, npm hoists a single compatible
version to the root `node_modules`. Metro/Next/TypeScript may resolve
the root copy at runtime even when the workspace-local copy is
correct. This bit us twice in Phase 0: once with `@types/react`
(typecheck errors in mobile) and once with `react` (runtime version
mismatch with React Native's renderer).

Decision: for any package that needs to be version-locked across
workspaces, pin it explicitly in the root `package.json` `overrides`
field. Currently pinned: `react` at `19.1.0`, `@types/react` at
`19.1.17`.

Reason: makes every workspace's resolution deterministic regardless
of how npm chooses to dedupe. Non-negotiable for packages with strict
version coupling — for example `react` must exactly match the React
version that React Native's renderer was built against, or the phone
bundle refuses to load.

Operational note: `overrides` only applies on fresh resolution.
Changing the field requires deleting `package-lock.json` and all
`node_modules`, then `npm install`, for the new values to take effect.

---

## Per-app `.env.local` files, not a shared root file
*Phase 1*

Each app gets its own `.env.local` (and committed `.env.example`) in
its workspace directory. The root `.env.local` holds only API vars.

- `apps/api/` → reads root `.env.local` via `godotenv`.
- `apps/web/` → Next.js auto-loads `apps/web/.env.local`.
- `apps/mobile/` → Expo auto-loads `apps/mobile/.env.local`.

Reason: Next.js and Expo each load env files from their own project
directory, not the monorepo root. Keeping one shared file at the root
would mean writing extra tooling to copy or symlink vars into each
app, or using cross-workspace dotenv loaders — both buy complexity
we don't need. Per-app files match how each tool expects to be used,
and each workspace's `.env.example` documents exactly what that app
needs.

Trade-off: the Clerk publishable key appears in two `.env.example`
files (web and mobile). Acceptable — they're conceptually different
clients that happen to share a value, and the duplication is exactly
two lines.

---

## Clerk Go SDK v2
*Phase 1*

Using `github.com/clerk/clerk-sdk-go/v2` (currently v2.5.1) for Clerk
integration on the API. `clerk.SetKey(secret)` at startup configures
the package globally; `jwt.Verify(ctx, &jwt.VerifyParams{Token: t})`
handles JWKS fetching, caching, and signature verification.

Reason: first-party SDK, maintained alongside the Clerk service, and
the v2 line is the current supported major version (v1 is in
maintenance-only mode). No reason to roll our own JWT verifier when
the official SDK handles key rotation and JWKS caching transparently.

---

## Air for Go hot reload; plain `go run` kept as fallback
*Phase 1*

`make dev` uses [Air](https://github.com/air-verse/air) to watch
`*.go` files and rebuild/restart on save. `make run` is kept as the
dep-free one-shot (plain `go run ./cmd/api/...`) so a fresh clone
without Air installed can still boot the API.

Reason: hot reload is a real productivity win in a phase with lots
of small server-side iterations. Air is the de-facto standard in
Go dev tooling, small and well-maintained. Keeping `make run` as the
fallback means Air stays a developer convenience — not a hard
requirement for running the project.

Air config (`.air.toml`) lives in `apps/api/` alongside the Makefile
so Air runs with the same cwd as `make run`, which keeps
`godotenv.Load("../../.env.local")` in `main.go` resolving correctly
without code changes.

---

## Clerk is the source of truth for identity; client is never trusted
*Phase 1*

`POST /users/sync` takes no request body. The authenticated Clerk
user ID comes from the verified JWT (via the Auth middleware's
context). Email, name, and avatar come from a server-to-server call
to Clerk's API (`user.Get`). The client never asserts "I am
alice@example.com" — only Clerk does.

Reason: if we accepted identity fields from the client body, a signed-
in user could claim any email or name and have us mirror it into our
database unchanged. Making the server round-trip to Clerk costs one
extra call per sync (rare — once per sign-in), and in return no
mirror field can be lied about.

Trade-off considered and rejected: **custom JWT claims** (add email
to the Clerk-issued JWT via a JWT template) would skip the Clerk API
call. We didn't do this because it adds dashboard configuration we
haven't committed to, and sync is infrequent enough that one extra
HTTP hop per sign-in is not worth optimizing yet.

---

## Explicit `/users/sync` on sign-in, not lazy creation on any endpoint
*Phase 1*

Clients are expected to call `POST /users/sync` once on every sign-in.
Other authenticated endpoints assume the local row exists — if a
client hits `GET /users/me` without syncing first, it gets a 404 with
a specific "not synced yet" message rather than a silent background
upsert.

Reason: lazy creation (auto-upsert inside every handler that needs a
user) would hide the "user just signed in" moment, spread the
Clerk-fetch logic across every handler that touches a user, and make
it harder to run one-time hooks on first sign-in later (welcome
email, onboarding flags, default circle membership). An explicit
endpoint keeps that moment addressable.

Trade-off: clients have one extra call on sign-in. Acceptable —
mobile and web both already have a natural "post-sign-in"
callback where this fits cleanly.

---

## Repository pattern for database access
*Phase 1*

All SQL lives under `internal/repo/`. Handlers do not touch the
database directly — they call methods on a repo struct that holds the
connection pool. One file per entity (`repo/users.go`,
`repo/circles.go` when that phase arrives).

Reason: keeps HTTP concerns (status codes, JSON shape, request
parsing) and DB concerns (SQL text, scanning, error-to-sentinel
mapping) from bleeding into each other. Also makes handlers testable
against a fake repo later without standing up a database — we aren't
building that harness today, but the structure leaves the door open.

Trade-off: one more layer of indirection than "just call pgx in the
handler." The tax is small and pays for itself the first time two
different handlers need the same query (which will happen in Phase 3
around memberships).

---

## Deferred: Expo splash and icon theming
*Phase 1 — step 5a*

The Expo Go splash screen and app icon currently use default scaffold
assets (white background, generic icon framing) before the JS bundle
loads. Known and explicitly deferred.

Reason: splash and icon come from `app.json` config (`expo.splash`,
`expo.icon`, `expo.ios.icon`, `expo.android.icon`,
`expo.android.adaptiveIcon`) and need real asset files. They don't
affect day-to-day development — Expo Go shows the splash before our
code runs, so nothing we build can change that experience until we
cut a dev client or production build.

Right time to address: first `eas build` (dev client or internal
testing). That's when we'll need:
- Slate-950 splash background matching the app palette
- iOS icon at all required sizes
- Android adaptive icon (foreground + background layers)
- App Store / Play Store icons

Until then, default assets are accepted and not worth a detour.

---

## Deferred: production Google OAuth credentials and Apple Sign-In
*Phase 1 — step 5c*

**Production Google OAuth credentials.** Clerk's dev instance uses
Clerk's shared Google OAuth client for "Continue with Google" — no
Google Cloud Console setup needed for development. Production will
need our own:

- Create an OAuth 2.0 client in Google Cloud Console
- Configure the authorized redirect URIs to match Clerk's production
  callback URL (Clerk dashboard shows the exact value once we
  promote the instance to production)
- Add the client ID + secret to Clerk's Google connection on the
  production instance

Right time to address: when we cut the production Clerk instance at
deploy time. Dev shared credentials are the right path until then.

**Apple Sign-In.** App Store policy requires offering Apple Sign-In
if any third-party SSO is present. We have Google, so iOS submission
will require us to add `expo-apple-authentication` and an Apple
Sign-In button alongside the Google one — same Clerk SSO mechanism,
different `strategy: 'oauth_apple'`. Doesn't apply to dev builds or
Android. Deferred to TestFlight prep.
