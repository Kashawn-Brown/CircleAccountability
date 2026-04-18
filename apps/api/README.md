# Circle Accountability — API

Go 1.23 HTTP API for the Circle Accountability app. Uses
[chi](https://github.com/go-chi/chi) for routing and
[pgx](https://github.com/jackc/pgx) for PostgreSQL.

## Prerequisites

- Go 1.23+
- Docker (for local Postgres via `docker compose`)
- [golang-migrate](https://github.com/golang-migrate/migrate) — for running
  SQL migrations. On Windows: `scoop install migrate` or download the
  release binary.
- [Air](https://github.com/air-verse/air) (optional, recommended for dev) —
  installs Go hot-reload. `go install github.com/air-verse/air@latest`

## Environment variables

Copy the root `.env.example` to `.env.local` at the repo root and fill in
values. The API reads it on startup via `godotenv` from `cmd/api/main.go`.

| var | required | what |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string (`sslmode=disable` locally) |
| `CLERK_SECRET_KEY` | yes | Clerk secret key for verifying session JWTs |
| `API_PORT` | no (default `8090`) | HTTP port |
| `API_ENV` | no (default `development`) | `development` \| `staging` \| `production` |

## Running

```
cd apps/api

# One-shot (no dependencies beyond Go):
make run

# With hot reload (recommended for dev, requires Air installed):
make dev
```

Both commands load `../../.env.local` and connect to Postgres before
binding to `:$API_PORT`. Air rebuilds and restarts the server on any
`*.go` change; config lives in `apps/api/.air.toml`.

## Database

Start Postgres from the repo root:

```
docker compose up -d
```

Run migrations:

```
make migrate-up      # apply all pending
make migrate-down    # roll back the most recent
make migrate-status  # show current version
```

Migrations live in `migrations/`, numbered `000001_`, `000002_`, etc.
Each has paired `.up.sql` and `.down.sql` files.

## Routes

Public:
- `GET /health` — liveness probe. Returns `{ "status": "ok", "env": "..." }`.

Protected (require `Authorization: Bearer <clerk-session-jwt>`):
- `POST /api/v1/users/sync` — upserts the local `users` row from the
  authenticated Clerk user's current profile (email, name, avatar).
  Idempotent; clients call this once on every sign-in. Returns the row.
- `GET /api/v1/users/me` — returns the local `users` row for the
  authenticated user. 404 if the client hasn't called `/users/sync` yet.

## Layout

```
cmd/api/          Runnable binary — main.go wires everything up.
internal/         Private packages (Go compiler enforces this).
  config/         Loads and validates env vars at startup.
  db/             pgx connection pool.
  handler/        HTTP handlers — read request, call repo + SDKs, serialize JSON.
  middleware/     Logger, CORS, Auth.
  repo/           Database access — one file per entity, holds the SQL.
migrations/       golang-migrate SQL files.
.air.toml         Hot-reload config for `make dev`.
Makefile          Common commands: run, dev, build, migrate-*, test, lint.
```

## Testing and linting

```
make test   # go test ./...
make lint   # go vet ./...
```

No unit tests yet — Phase 1 wraps up before CI lands, at which point
the critical-path tests listed in `plan.md` get added.
