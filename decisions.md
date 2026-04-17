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

- Mobile: Expo + React Native + TypeScript
- Web: Next.js 15 App Router + TypeScript
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
