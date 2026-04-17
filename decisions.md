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
